// Copyright 2019-2022 @subwallet/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * This file now is only for readonly
 **/

import { ApiMap, ApiProps, CustomEvmToken, NETWORK_STATUS, NetworkJson, NftTransferExtra, ServiceInfo, StakingRewardJson } from '@subwallet/extension-base/background/KoniTypes';
import { getTokenPrice } from '@subwallet/extension-koni-base/api/coingecko';
import { fetchDotSamaHistory } from '@subwallet/extension-koni-base/api/subquery/history';
import { state } from '@subwallet/extension-koni-base/background/handlers';
import { KoniSubscription } from '@subwallet/extension-koni-base/background/subscription';
import { CRON_AUTO_RECOVER_DOTSAMA_INTERVAL, CRON_GET_API_MAP_STATUS_INTERVAL, CRON_REFRESH_HISTORY_INTERVAL, CRON_REFRESH_NFT_INTERVAL, CRON_REFRESH_PRICE_INTERVAL, CRON_REFRESH_STAKE_UNLOCKING_INFO_INTERVAL, CRON_REFRESH_STAKING_REWARD_INTERVAL } from '@subwallet/extension-koni-base/constants';
import { Subject, Subscription } from 'rxjs';

export const KONI_CRON_DEFAULT_OPTIONS = {
  autoRecoverDotsamaInterval: CRON_AUTO_RECOVER_DOTSAMA_INTERVAL,
  getApiMapStatusInterval: CRON_GET_API_MAP_STATUS_INTERVAL,
  refreshHistoryInterval: CRON_REFRESH_HISTORY_INTERVAL,
  refreshNftInterval: CRON_REFRESH_NFT_INTERVAL,
  refreshPriceInterval: CRON_REFRESH_PRICE_INTERVAL,
  refreshStakeUnlockingInfoInterval: CRON_REFRESH_STAKE_UNLOCKING_INFO_INTERVAL,
  refreshStakingRewardInterval: CRON_REFRESH_STAKING_REWARD_INTERVAL
};

export type KoniCronOptions = typeof KONI_CRON_DEFAULT_OPTIONS;

export class KoniCron {
  subscriptions: KoniSubscription;
  public status: 'pending' | 'running' | 'stopped' = 'pending';
  private serviceSubscription: Subscription | undefined;
  private options: KoniCronOptions;

  constructor (subscriptions: KoniSubscription, options?: KoniCronOptions) {
    this.subscriptions = subscriptions;
    this.options = options || KONI_CRON_DEFAULT_OPTIONS;

    console.log('Init cronjobs with options', options);

    // Validate and auto transform options
    Object.entries(this.options).forEach(([key, val]) => {
      if (val < 0) {
        this.options[key as keyof KoniCronOptions] = 0;
      }
    });
    this.init();
  }

  private cronMap: Record<string, any> = {};
  private subjectMap: Record<string, Subject<any>> = {};

  getCron (name: string): any {
    return this.cronMap[name];
  }

  getSubjectMap (name: string): any {
    return this.subjectMap[name];
  }

  addCron (name: string, callback: (param?: any) => void, interval: number, runFirst = true) {
    if (runFirst) {
      callback();
    }

    this.cronMap[name] = setInterval(callback, interval);
  }

  addSubscribeCron<T> (name: string, callback: (subject: Subject<T>) => void, interval: number) {
    const sb = new Subject<T>();

    callback(sb);
    this.subjectMap[name] = sb;
    this.cronMap[name] = setInterval(callback, interval);
  }

  removeCron (name: string) {
    const interval = this.cronMap[name] as number;

    if (interval) {
      clearInterval(interval);
      delete this.cronMap[name];
    }
  }

  removeAllCrons () {
    Object.entries(this.cronMap).forEach(([key, interval]) => {
      clearInterval(interval as number);
      delete this.cronMap[key];
    });
  }

  init () {
    const { getApiMapStatusInterval, refreshHistoryInterval, refreshNftInterval, refreshPriceInterval, refreshStakeUnlockingInfoInterval, refreshStakingRewardInterval } = this.options;

    state.getCurrentAccount((currentAccountInfo) => {
      if (!currentAccountInfo?.address) {
        return;
      }

      if (Object.keys(state.getDotSamaApiMap()).length !== 0 || Object.keys(state.getWeb3ApiMap()).length !== 0) {
        refreshPriceInterval && this.refreshPrice();
        getApiMapStatusInterval && this.updateApiMapStatus();
        refreshNftInterval && this.refreshNft(currentAccountInfo.address, state.getApiMap(), state.getActiveErc721Tokens())();
        refreshStakeUnlockingInfoInterval && this.refreshStakingReward(currentAccountInfo.address)();
        refreshHistoryInterval && this.resetHistory(currentAccountInfo.address).then(() => {
          this.refreshHistory(currentAccountInfo.address, state.getNetworkMap())();
        }).catch((err) => console.warn(err));
      } else {
        refreshNftInterval && this.setNftReady(currentAccountInfo.address);
        refreshStakingRewardInterval && this.setStakingRewardReady();
      }
    });
  }

  start () {
    if (this.status === 'running') {
      return;
    }

    const { autoRecoverDotsamaInterval, getApiMapStatusInterval, refreshHistoryInterval, refreshNftInterval, refreshPriceInterval, refreshStakeUnlockingInfoInterval, refreshStakingRewardInterval } = this.options;

    console.log('Stating cron jobs');
    state.getCurrentAccount((currentAccountInfo) => {
      if (!currentAccountInfo?.address) {
        return;
      }

      if (Object.keys(state.getDotSamaApiMap()).length !== 0 || Object.keys(state.getWeb3ApiMap()).length !== 0) {
        refreshNftInterval && this.resetNft(currentAccountInfo.address).then(() => {
          this.addCron('refreshNft', this.refreshNft(currentAccountInfo.address, state.getApiMap(), state.getActiveErc721Tokens()), refreshNftInterval);
        }).catch((err) => console.warn(err));

        refreshPriceInterval && this.addCron('refreshPrice', this.refreshPrice, refreshPriceInterval);
        getApiMapStatusInterval && this.addCron('checkStatusApiMap', this.updateApiMapStatus, getApiMapStatusInterval);
        autoRecoverDotsamaInterval && this.addCron('recoverApiMap', this.recoverApiMap, autoRecoverDotsamaInterval, false);
        refreshStakingRewardInterval && this.addCron('refreshStakingReward', this.refreshStakingReward(currentAccountInfo.address), refreshStakingRewardInterval);
        refreshStakeUnlockingInfoInterval && this.addCron('refreshStakeUnlockingInfo', this.refreshStakeUnlockingInfo(currentAccountInfo.address, state.getNetworkMap(), state.getDotSamaApiMap()), refreshStakeUnlockingInfoInterval);

        refreshHistoryInterval && this.resetHistory(currentAccountInfo.address).then(() => {
          this.addCron('refreshHistory', this.refreshHistory(currentAccountInfo.address, state.getNetworkMap()), refreshHistoryInterval);
        }).catch((err) => console.warn(err));
      } else {
        refreshNftInterval && this.setNftReady(currentAccountInfo.address);
        refreshStakingRewardInterval && this.setStakingRewardReady();
      }
    });

    this.serviceSubscription = state.subscribeServiceInfo().subscribe({
      next: (serviceInfo) => {
        const { address } = serviceInfo.currentAccountInfo;

        refreshNftInterval && this.resetNft(address).then(() => {
          this.resetNftTransferMeta();
          this.removeCron('refreshNft');

          if (this.checkNetworkAvailable(serviceInfo)) { // only add cron job if there's at least 1 active network
            this.addCron('refreshNft', this.refreshNft(address, serviceInfo.apiMap, serviceInfo.customErc721Registry), refreshNftInterval);
          }
        }).catch((err) => console.warn(err));

        // this.resetStakingReward(address);
        refreshHistoryInterval && this.resetHistory(address).then(() => {
          this.removeCron('refreshHistory');

          if (this.checkNetworkAvailable(serviceInfo)) { // only add cron job if there's at least 1 active network
            refreshHistoryInterval && this.addCron('refreshHistory', this.refreshHistory(address, serviceInfo.networkMap), refreshHistoryInterval);
          }
        }).catch((err) => console.warn(err));

        this.removeCron('refreshStakeUnlockingInfo');
        this.removeCron('refreshStakingReward');
        this.removeCron('refreshPrice');
        this.removeCron('checkStatusApiMap');
        this.removeCron('recoverApiMap');

        if (this.checkNetworkAvailable(serviceInfo)) { // only add cron job if there's at least 1 active network
          refreshPriceInterval && this.addCron('refreshPrice', this.refreshPrice, refreshPriceInterval);
          getApiMapStatusInterval && this.addCron('checkStatusApiMap', this.updateApiMapStatus, getApiMapStatusInterval);
          autoRecoverDotsamaInterval && this.addCron('recoverApiMap', this.recoverApiMap, autoRecoverDotsamaInterval, false);
          refreshStakingRewardInterval && this.addCron('refreshStakingReward', this.refreshStakingReward(address), CRON_REFRESH_STAKING_REWARD_INTERVAL);
          refreshStakeUnlockingInfoInterval && this.addCron('refreshStakeUnlockingInfo', this.refreshStakeUnlockingInfo(address, serviceInfo.networkMap, serviceInfo.apiMap.dotSama), CRON_REFRESH_STAKE_UNLOCKING_INFO_INTERVAL);
        } else {
          refreshNftInterval && this.setNftReady(address);
          refreshStakingRewardInterval && this.setStakingRewardReady();
        }
      }
    });

    this.status = 'running';
  }

  stop () {
    if (this.status === 'stopped') {
      return;
    }

    if (this.serviceSubscription) {
      this.serviceSubscription.unsubscribe();
      this.serviceSubscription = undefined;
    }

    console.log('Stopping cron jobs');
    this.removeAllCrons();

    this.status = 'stopped';
  }

  recoverApiMap () {
    const apiMap = state.getApiMap();

    for (const apiProp of Object.values(apiMap.dotSama)) {
      if (!apiProp.isApiConnected) {
        apiProp.recoverConnect && apiProp.recoverConnect();
      }
    }

    for (const [key, web3] of Object.entries(apiMap.web3)) {
      web3.eth.net.isListening()
        .catch(() => {
          state.refreshWeb3Api(key);
        });
    }

    state.getCurrentAccount(({ address }) => {
      this.subscriptions?.subscribeBalancesAndCrowdloans && this.subscriptions.subscribeBalancesAndCrowdloans(address, state.getDotSamaApiMap(), state.getWeb3ApiMap());
    });
  }

  updateApiMapStatus () {
    const apiMap = state.getApiMap();
    const networkMap = state.getNetworkMap();

    for (const [key, apiProp] of Object.entries(apiMap.dotSama)) {
      let status: NETWORK_STATUS = NETWORK_STATUS.CONNECTING;

      if (apiProp.isApiConnected) {
        status = NETWORK_STATUS.CONNECTED;
      }

      if (!networkMap[key].apiStatus) {
        state.updateNetworkStatus(key, status);
      } else if (networkMap[key].apiStatus && networkMap[key].apiStatus !== status) {
        state.updateNetworkStatus(key, status);
      }
    }

    for (const [key, web3] of Object.entries(apiMap.web3)) {
      web3.eth.net.isListening()
        .then(() => {
          if (!networkMap[key].apiStatus) {
            state.updateNetworkStatus(key, NETWORK_STATUS.CONNECTED);
          } else if (networkMap[key].apiStatus && networkMap[key].apiStatus !== NETWORK_STATUS.CONNECTED) {
            state.updateNetworkStatus(key, NETWORK_STATUS.CONNECTED);
          }
        })
        .catch(() => {
          if (!networkMap[key].apiStatus) {
            state.updateNetworkStatus(key, NETWORK_STATUS.CONNECTING);
          } else if (networkMap[key].apiStatus && networkMap[key].apiStatus !== NETWORK_STATUS.CONNECTING) {
            state.updateNetworkStatus(key, NETWORK_STATUS.CONNECTING);
          }
        });
    }
  }

  refreshPrice () {
    // Update for tokens price
    const coinGeckoKeys = Object.values(state.getNetworkMap()).map((network) => network.coinGeckoKey).filter((key) => key) as string[];

    getTokenPrice(coinGeckoKeys)
      .then((rs) => {
        state.setPrice(rs, () => {
          console.log('Get Token Price From CoinGecko');
        });
      })
      .catch((err) => console.log(err));
  }

  refreshNft (address: string, apiMap: ApiMap, customErc721Registry: CustomEvmToken[]) {
    return () => {
      console.log('Refresh Nft state');
      this.subscriptions.subscribeNft(address, apiMap.dotSama, apiMap.web3, customErc721Registry);
    };
  }

  async resetNft (newAddress: string) {
    console.log('Reset Nft state');
    await Promise.all([
      state.resetNft(newAddress),
      state.resetNftCollection(newAddress)
    ]);
  }

  resetNftTransferMeta () {
    state.setNftTransfer({
      cronUpdate: false,
      forceUpdate: false
    } as NftTransferExtra);
  }

  resetStakingReward (address: string) {
    state.resetStakingMap(address).catch((err) => console.warn(err));
    state.setStakingReward({
      ready: false,
      details: []
    } as StakingRewardJson);
    // console.log('Reset Staking reward state');
  }

  refreshStakingReward (address: string) {
    return () => {
      this.subscriptions.subscribeStakingReward(address)
        .then(() => console.log('Refresh staking reward state'))
        .catch(console.error);
    };
  }

  refreshHistory (address: string, networkMap: Record<string, NetworkJson>) {
    return () => {
      console.log('Refresh History state');
      fetchDotSamaHistory(address, networkMap, (network, historyMap) => {
        console.log(`[${network}] historyMap: `, historyMap);
        state.setHistory(address, network, historyMap);
      });
    };
  }

  setNftReady (address: string) {
    state.updateNftReady(address, true);
  }

  refreshStakeUnlockingInfo (address: string, networkMap: Record<string, NetworkJson>, dotSamaApiMap: Record<string, ApiProps>) {
    return () => {
      this.subscriptions.subscribeStakeUnlockingInfo(address, networkMap, dotSamaApiMap)
        .then(() => console.log('Refresh staking unlocking info done'))
        .catch(console.error);
    };
  }

  setStakingRewardReady () {
    state.updateStakingRewardReady(true);
  }

  resetHistory (address: string): Promise<void> {
    return state.resetHistoryMap(address).catch((err) => console.warn(err));
  }

  checkNetworkAvailable (serviceInfo: ServiceInfo): boolean {
    return Object.keys(serviceInfo.apiMap.dotSama).length > 0 || Object.keys(serviceInfo.apiMap.web3).length > 0;
  }
}
