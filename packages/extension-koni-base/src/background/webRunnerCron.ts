// Copyright 2019-2022 @subwallet/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiMap, ApiProps, CronServiceType, CronType, CurrentAccountInfo, CustomEvmToken, NETWORK_STATUS, NetworkJson, NftTransferExtra, ServiceInfo, SubscriptionServiceType, UnlockingStakeInfo } from '@subwallet/extension-base/background/KoniTypes';
import { getUnlockingInfo } from '@subwallet/extension-koni-base/api/bonding';
import { getTokenPrice } from '@subwallet/extension-koni-base/api/coingecko';
import { getAllSubsquidStaking } from '@subwallet/extension-koni-base/api/staking/subsquidStaking';
import { fetchDotSamaHistory } from '@subwallet/extension-koni-base/api/subquery/history';
import { nftHandler } from '@subwallet/extension-koni-base/background/handlers';
import KoniState from '@subwallet/extension-koni-base/background/handlers/State';
import WebRunnerSubscription from '@subwallet/extension-koni-base/background/webRunnerSubscription';
import { CRON_AUTO_RECOVER_DOTSAMA_INTERVAL, CRON_GET_API_MAP_STATUS, CRON_REFRESH_HISTORY_INTERVAL, CRON_REFRESH_NFT_INTERVAL, CRON_REFRESH_PRICE_INTERVAL, CRON_REFRESH_STAKE_UNLOCKING_INFO, CRON_REFRESH_STAKING_REWARD_INTERVAL } from '@subwallet/extension-koni-base/constants';
import { Subject, Subscription } from 'rxjs';
import Web3 from 'web3';

import { logger as createLogger } from '@polkadot/util/logger';
import { Logger } from '@polkadot/util/types';
import { isEthereumAddress } from '@polkadot/util-crypto';

const defaultIntervalMap: Record<CronType, number> = {
  recoverApiMap: CRON_AUTO_RECOVER_DOTSAMA_INTERVAL,
  checkApiMapStatus: CRON_GET_API_MAP_STATUS,
  refreshHistory: CRON_REFRESH_HISTORY_INTERVAL,
  refreshNft: CRON_REFRESH_NFT_INTERVAL,
  refreshPrice: CRON_REFRESH_PRICE_INTERVAL,
  refreshStakeUnlockingInfo: CRON_REFRESH_STAKE_UNLOCKING_INFO,
  refreshStakingReward: CRON_REFRESH_STAKING_REWARD_INTERVAL
};

const cronServiceRelationMap: Record<CronServiceType, CronType[]> = {
  checkApiStatus: ['checkApiMapStatus'],
  recoverApi: ['recoverApiMap'],
  history: ['refreshHistory'],
  nft: ['refreshNft'],
  price: ['refreshPrice'],
  staking: ['refreshStakeUnlockingInfo', 'refreshStakingReward']
};

export default class WebRunnerCron {
  private readonly activeServiceMap: Record<CronServiceType, boolean>;
  private readonly serviceInfoSubscriptionMap: Record<CronServiceType, Subscription | undefined>;
  private readonly cronMap: Record<CronType, NodeJS.Timer | undefined>;
  private readonly intervalMap: Record<CronType, number>;
  private readonly activeServiceMapSubject: Subject<Record<CronServiceType, boolean>>;
  private webRunnerSubscription: WebRunnerSubscription;
  private state: KoniState;
  private logger: Logger;

  constructor (state: KoniState, webRunnerSubscription: WebRunnerSubscription, intervalMap: Record<CronType, number> = defaultIntervalMap) {
    this.state = state;
    this.webRunnerSubscription = webRunnerSubscription;
    this.intervalMap = intervalMap;
    this.activeServiceMapSubject = new Subject<Record<CronServiceType, boolean>>();
    this.logger = createLogger('WebRunnerCron');
    this.activeServiceMap = {
      checkApiStatus: false,
      recoverApi: false,
      history: false,
      nft: false,
      price: false,
      staking: false
    };
    this.serviceInfoSubscriptionMap = {
      checkApiStatus: undefined,
      recoverApi: undefined,
      history: undefined,
      nft: undefined,
      price: undefined,
      staking: undefined
    };
    this.cronMap = {
      recoverApiMap: undefined,
      checkApiMapStatus: undefined,
      refreshHistory: undefined,
      refreshNft: undefined,
      refreshPrice: undefined,
      refreshStakeUnlockingInfo: undefined,
      refreshStakingReward: undefined
    };
  }

  // price

  private refreshPrice = () => {
    // Update for tokens price
    const coinGeckoKeys = Object.values(this.state.getNetworkMap())
      .map((network) => network.coinGeckoKey).filter((key) => key) as string[];

    getTokenPrice(coinGeckoKeys)
      .then((rs) => {
        this.state.setPrice(rs, () => {
          this.logger.log('Get Token Price From CoinGecko');
        });
      })
      .catch(this.logger.warn);
  };

  // nft

  private nftHandle = (
    addresses: string[],
    dotSamaApiMap: Record<string, ApiProps>,
    web3ApiMap: Record<string, Web3>,
    customErc721Registry:
    CustomEvmToken[]) => {
    const { cronUpdate, forceUpdate, selectedNftCollection } = this.state.getNftTransfer();

    if (forceUpdate && !cronUpdate) {
      this.logger.log('skipping set nft state due to transfer');
      this.state.setNftTransfer({
        cronUpdate: true,
        forceUpdate: true,
        selectedNftCollection
      } as NftTransferExtra);
    } else { // after skipping 1 time of cron update
      this.state.setNftTransfer({
        cronUpdate: false,
        forceUpdate: false,
        selectedNftCollection
      } as NftTransferExtra);
      nftHandler.setApiProps(dotSamaApiMap);
      nftHandler.setWeb3ApiMap(web3ApiMap);
      nftHandler.setAddresses(addresses);
      nftHandler.handleNfts(
        customErc721Registry,
        (...args) => this.state.updateNftData(...args),
        (...args) => this.state.setNftCollection(...args),
        (...args) => this.state.updateNftIds(...args),
        (...args) => this.state.updateCollectionIds(...args))
        .then(() => {
          this.logger.log('nft state updated');
        })
        .catch(this.logger.warn);
    }
  };

  private refreshNft = (address: string, apiMap: ApiMap, customErc721Registry: CustomEvmToken[]) => {
    return () => {
      this.logger.log('Refresh Nft state');
      this.state.getDecodedAddresses(address)
        .then((addresses) => {
          if (!addresses.length) {
            return;
          }

          this.nftHandle(addresses, apiMap.dotSama, apiMap.web3, customErc721Registry);
        })
        .catch(this.logger.warn);
    };
  };

  private resetNft = (newAddress: string) => {
    this.logger.log('Reset Nft state');
    this.state.resetNft(newAddress).catch(this.logger.warn);
  };

  private resetNftTransferMeta = () => {
    this.state.setNftTransfer({
      cronUpdate: false,
      forceUpdate: false
    } as NftTransferExtra);
  };

  // staking

  private stakingRewardHandle = async (address: string) => {
    const addresses = await this.state.getDecodedAddresses(address);
    const networkMap = this.state.getNetworkMap();
    const activeNetworks: string[] = [];

    if (!addresses.length) {
      return;
    }

    Object.entries(networkMap).forEach(([key, network]) => {
      if (network.active) {
        activeNetworks.push(key);
      }
    });

    getAllSubsquidStaking(addresses, activeNetworks)
      .then((result) => {
        this.state.setStakingReward(result);
        this.logger.log('set staking reward state done', result);
      })
      .catch(this.logger.warn);
  };

  private refreshStakingReward = (address: string) => {
    return () => {
      this.stakingRewardHandle(address)
        .then(() => this.logger.log('Refresh staking reward state'))
        .catch(this.logger.warn);
    };
  };

  private stakeUnlockingInfoHandle = async (address: string, networkMap: Record<string, NetworkJson>, dotSamaApiMap: Record<string, ApiProps>) => {
    const addresses = await this.state.getDecodedAddresses(address);
    const currentAddress = addresses[0]; // only get info for the current account

    const stakeUnlockingInfo: Record<string, UnlockingStakeInfo> = {};

    if (!addresses.length) {
      return;
    }

    const currentStakingInfo = this.state.getStaking().details;

    if (!addresses.length) {
      return;
    }

    await Promise.all(Object.entries(networkMap).map(async ([networkKey, networkJson]) => {
      const needUpdateUnlockingStake = currentStakingInfo[networkKey] && currentStakingInfo[networkKey].balance && parseFloat(currentStakingInfo[networkKey].balance as string) > 0;

      if (isEthereumAddress(currentAddress)) {
        if (networkJson.supportBonding && networkJson.active && networkJson.isEthereum && needUpdateUnlockingStake) {
          stakeUnlockingInfo[networkKey] = await getUnlockingInfo(dotSamaApiMap[networkKey], networkJson, networkKey, currentAddress);
        }
      } else {
        if (networkJson.supportBonding && networkJson.active && !networkJson.isEthereum && needUpdateUnlockingStake) {
          stakeUnlockingInfo[networkKey] = await getUnlockingInfo(dotSamaApiMap[networkKey], networkJson, networkKey, currentAddress);
        }
      }
    }));

    this.state.setStakeUnlockingInfo({
      timestamp: +new Date(),
      details: stakeUnlockingInfo
    });
  };

  private refreshStakeUnlockingInfo = (address: string, networkMap: Record<string, NetworkJson>, dotSamaApiMap: Record<string, ApiProps>) => {
    return () => {
      this.stakeUnlockingInfoHandle(address, networkMap, dotSamaApiMap)
        .then(() => this.logger.log('Refresh staking unlocking info done'))
        .catch(this.logger.warn);
    };
  };

  // history

  private refreshHistory = (address: string, networkMap: Record<string, NetworkJson>) => {
    return () => {
      this.logger.log('Refresh History state');
      fetchDotSamaHistory(address, networkMap, (network, historyMap) => {
        this.logger.log(`[${network}] historyMap: `, historyMap);
        this.state.setHistory(address, network, historyMap);
      });
    };
  };

  private resetHistory = (address: string): Promise<void> => {
    return this.state.resetHistoryMap(address).catch(this.logger.warn);
  };

  // recoverApi

  private recoverApiMap = () => {
    const apiMap = this.state.getApiMap();

    let refreshCounter = 0;

    for (const apiProp of Object.values(apiMap.dotSama)) {
      if (!apiProp.isApiConnected) {
        apiProp.recoverConnect && apiProp.recoverConnect();

        refreshCounter++;
      }
    }

    for (const [key, web3] of Object.entries(apiMap.web3)) {
      web3.eth.net.isListening()
        .catch(() => {
          this.state.refreshWeb3Api(key);
          refreshCounter++;
        });
    }

    if (refreshCounter > 0) {
      const activeSubscriptionServiceMap = this.webRunnerSubscription.getActiveServiceMap();

      (Object.keys(activeSubscriptionServiceMap) as SubscriptionServiceType[]).forEach((type) => {
        if (activeSubscriptionServiceMap[type]) {
          this.webRunnerSubscription.restartService(type);
        }
      });

      this.webRunnerSubscription.getActiveServiceMapSubject().next(this.webRunnerSubscription.getActiveServiceMap());
    }
  };

  // checkApiStatus

  private checkStatusApiMap = () => {
    const apiMap = this.state.getApiMap();
    const networkMap = this.state.getNetworkMap();

    for (const [key, apiProp] of Object.entries(apiMap.dotSama)) {
      let status: NETWORK_STATUS = NETWORK_STATUS.CONNECTING;

      if (apiProp.isApiConnected) {
        status = NETWORK_STATUS.CONNECTED;
      }

      if (!networkMap[key].apiStatus) {
        this.state.updateNetworkStatus(key, status);
      } else if (networkMap[key].apiStatus && networkMap[key].apiStatus !== status) {
        this.state.updateNetworkStatus(key, status);
      }
    }

    for (const [key, web3] of Object.entries(apiMap.web3)) {
      web3.eth.net.isListening()
        .then(() => {
          if (!networkMap[key].apiStatus) {
            this.state.updateNetworkStatus(key, NETWORK_STATUS.CONNECTED);
          } else if (networkMap[key].apiStatus && networkMap[key].apiStatus !== NETWORK_STATUS.CONNECTED) {
            this.state.updateNetworkStatus(key, NETWORK_STATUS.CONNECTED);
          }
        })
        .catch(() => {
          if (!networkMap[key].apiStatus) {
            this.state.updateNetworkStatus(key, NETWORK_STATUS.CONNECTING);
          } else if (networkMap[key].apiStatus && networkMap[key].apiStatus !== NETWORK_STATUS.CONNECTING) {
            this.state.updateNetworkStatus(key, NETWORK_STATUS.CONNECTING);
          }
        });
    }
  };

  private addCron = (name: CronType, callback: () => void, interval: number, runFirst = true) => {
    if (runFirst) {
      callback();
    }

    this.cronMap[name] = setInterval(callback, interval);
  };

  private removeCron = (name: CronType) => {
    const interval = this.cronMap[name];

    if (interval) {
      clearInterval(interval);
      this.cronMap[name] = undefined;
    }
  };

  private onStartService = (
    type: CronServiceType,
    onGetCurrentAccount?: (currentAccountInfo: CurrentAccountInfo) => void,
    onSubscribeServiceInfo?: (serviceInfo: ServiceInfo) => void): void => {
    if (onGetCurrentAccount) {
      this.state.getCurrentAccount((currentAccountInfo) => {
        if (!currentAccountInfo?.address) {
          return;
        }

        onGetCurrentAccount(currentAccountInfo);
      });
    }

    if (onSubscribeServiceInfo) {
      this.serviceInfoSubscriptionMap[type] = this.state.subscribeServiceInfo().subscribe({
        next: (serviceInfo) => {
          onSubscribeServiceInfo(serviceInfo);
        }
      });
    }
  };

  public init = (intervalMap: Partial<Record<CronType, number>>, activeServices: CronServiceType[]) => {
    Object.assign(this.intervalMap, intervalMap);

    if (activeServices.length) {
      activeServices.forEach((type) => {
        if (!this.activeServiceMap[type]) {
          this.startService(type);
        }
      });
    }

    this.activeServiceMapSubject.next(this.activeServiceMap);
  };

  public getActiveServiceMap = () => {
    return this.activeServiceMap;
  };

  public getActiveServiceMapSubject = (): Subject<Record<CronServiceType, boolean>> => {
    return this.activeServiceMapSubject;
  };

  public startService = (type: CronServiceType, isEmitActiveServiceMap?: boolean): void => {
    if (this.activeServiceMap[type]) {
      this.logger.log(`Ignore startService, cron service "${type}" is active`);

      return;
    }

    if (type === 'price') {
      this.onStartService(type,
        () => {
          this.addCron('refreshPrice', this.refreshPrice, this.intervalMap.refreshPrice);
        },
        () => {
          this.removeCron('refreshPrice');
          this.addCron('refreshPrice', this.refreshPrice, this.intervalMap.refreshPrice);
        }
      );
    } else if (type === 'nft') {
      this.onStartService(type,
        (currentAccountInfo) => {
          this.resetNft(currentAccountInfo.address);
          this.addCron('refreshNft',
            this.refreshNft(currentAccountInfo.address,
              this.state.getApiMap(),
              this.state.getActiveErc721Tokens()),
            this.intervalMap.refreshNft);
        },
        (serviceInfo) => {
          const { address } = serviceInfo.currentAccountInfo;

          this.resetNft(address);
          this.resetNftTransferMeta();
          this.removeCron('refreshNft');
          this.addCron('refreshNft',
            this.refreshNft(address, serviceInfo.apiMap, serviceInfo.customErc721Registry),
            this.intervalMap.refreshNft);
        }
      );
    } else if (type === 'staking') {
      this.onStartService(type,
        (currentAccountInfo) => {
          this.addCron('refreshStakingReward',
            this.refreshStakingReward(currentAccountInfo.address),
            this.intervalMap.refreshStakingReward);
          this.addCron('refreshStakeUnlockingInfo',
            this.refreshStakeUnlockingInfo(
              currentAccountInfo.address,
              this.state.getNetworkMap(),
              this.state.getDotSamaApiMap()),
            this.intervalMap.refreshStakeUnlockingInfo);
        },
        (serviceInfo) => {
          const { address } = serviceInfo.currentAccountInfo;

          this.removeCron('refreshStakeUnlockingInfo');
          this.removeCron('refreshStakingReward');

          this.addCron('refreshStakingReward',
            this.refreshStakingReward(address),
            this.intervalMap.refreshStakingReward);
          this.addCron('refreshStakeUnlockingInfo',
            this.refreshStakeUnlockingInfo(address, serviceInfo.networkMap, serviceInfo.apiMap.dotSama),
            this.intervalMap.refreshStakeUnlockingInfo);
        }
      );
    } else if (type === 'recoverApi') {
      this.addCron('recoverApiMap', this.recoverApiMap, this.intervalMap.recoverApiMap, false);
    } else if (type === 'checkApiStatus') {
      this.addCron('checkApiMapStatus', this.checkStatusApiMap, this.intervalMap.checkApiMapStatus);
    } else if (type === 'history') {
      this.onStartService(type,
        (currentAccountInfo) => {
          this.resetHistory(currentAccountInfo.address).then(() => {
            this.addCron('refreshHistory',
              this.refreshHistory(currentAccountInfo.address, this.state.getNetworkMap()),
              this.intervalMap.refreshHistory);
          }).catch(this.logger.warn);
        }
      );
    }

    this.activeServiceMap[type] = true;

    if (isEmitActiveServiceMap) {
      this.activeServiceMapSubject.next(this.activeServiceMap);
    }
  };

  public stopService = (ServiceType: CronServiceType, isEmitActiveServiceMap?: boolean) => {
    if (!this.activeServiceMap[ServiceType]) {
      this.logger.log(`Ignore stopService, cron service "${ServiceType}" is not active`);

      return;
    }

    if (this.serviceInfoSubscriptionMap[ServiceType]) {
      this.serviceInfoSubscriptionMap[ServiceType]?.unsubscribe();
      this.serviceInfoSubscriptionMap[ServiceType] = undefined;
    }

    cronServiceRelationMap[ServiceType].forEach((cronType) => {
      this.removeCron(cronType);
    });

    this.activeServiceMap[ServiceType] = false;

    if (isEmitActiveServiceMap) {
      this.activeServiceMapSubject.next(this.activeServiceMap);
    }
  };

  public restartService = (type: CronServiceType, isEmitActiveServiceMap?: boolean) => {
    if (!this.activeServiceMap[type]) {
      this.logger.log(`Ignore restartService, cron service "${type}" is not active`);

      return;
    }

    this.stopService(type);
    this.startService(type);

    if (isEmitActiveServiceMap) {
      this.activeServiceMapSubject.next(this.activeServiceMap);
    }
  };
}
