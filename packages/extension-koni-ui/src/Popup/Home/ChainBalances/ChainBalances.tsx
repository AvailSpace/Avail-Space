// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { NETWORK_STATUS, NetWorkMetadataDef } from '@subwallet/extension-base/background/KoniTypes';
import { ALL_NETWORK_KEY } from '@subwallet/extension-koni-base/constants';
import { Link } from '@subwallet/extension-koni-ui/components';
import useTranslation from '@subwallet/extension-koni-ui/hooks/useTranslation';
import { hasAnyChildTokenBalance } from '@subwallet/extension-koni-ui/Popup/Home/ChainBalances/utils';
import { RootState } from '@subwallet/extension-koni-ui/stores';
import { ModalQrProps, ThemeProps } from '@subwallet/extension-koni-ui/types';
import { BN_ZERO, getLogoByNetworkKey } from '@subwallet/extension-koni-ui/util';
import reformatAddress from '@subwallet/extension-koni-ui/util/reformatAddress';
import { AccountInfoByNetwork, BalanceInfo } from '@subwallet/extension-koni-ui/util/types';
import BigN from 'bignumber.js';
import CN from 'classnames';
import React, { Fragment, useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { isEthereumAddress } from '@polkadot/util-crypto';

const ChainBalanceDetail = React.lazy(() => import('../ChainBalances/ChainBalanceDetail/ChainBalanceDetail'));
const ChainBalanceItem = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Home/ChainBalances/ChainBalanceItem'));
const ChainBalanceDetailItem = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Home/ChainBalances/ChainBalanceDetail/ChainBalanceDetailItem'));

const WAITING_FOR_CONNECTION = 5000;

interface Props extends ThemeProps {
  address: string;
  className?: string;
  currentNetworkKey: string;
  isShowBalanceDetail: boolean;
  isShowZeroBalances: boolean;
  networkBalanceMaps: Record<string, BalanceInfo>;
  networkKeys: string[];
  networkMetadataMap: Record<string, NetWorkMetadataDef>;
  setIsExportModalOpen: (visible: boolean) => void;
  setQrModalOpen: (visible: boolean) => void;
  updateModalQr: (value: Partial<ModalQrProps>) => void;
  setShowBalanceDetail: (isShowBalanceDetail: boolean) => void;
  setSelectedNetworkBalance?: (networkBalance: BigN) => void;
}

interface ConnectingState {
  status: 'pending' | 'done',
  timestamp: number
}

function isAllowToShow (
  isShowZeroBalances: boolean,
  currentNetworkKey: string,
  networkKey: string,
  balanceInfo?: BalanceInfo): boolean {
  if (currentNetworkKey !== ALL_NETWORK_KEY || ['polkadot', 'kusama'].includes(networkKey)) {
    return true;
  }

  return isShowZeroBalances ||
    !!(balanceInfo &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      (balanceInfo.balanceValue.gt(BN_ZERO) || hasAnyChildTokenBalance(balanceInfo)));
}

function getAccountInfoByNetwork (
  address: string,
  networkKey: string,
  networkMetadata: NetWorkMetadataDef): AccountInfoByNetwork {
  return {
    address,
    key: networkKey,
    networkKey,
    networkDisplayName: networkMetadata.chain,
    networkPrefix: networkMetadata.ss58Format,
    networkLogo: getLogoByNetworkKey(networkKey),
    networkIconTheme: networkMetadata.isEthereum ? 'ethereum' : (networkMetadata.icon || 'polkadot'),
    formattedAddress: reformatAddress(address, networkMetadata.ss58Format, networkMetadata.isEthereum)
  };
}

function getAccountInfoByNetworkMap (
  address: string,
  networkKeys: string[],
  networkMetadataMap: Record<string, NetWorkMetadataDef>): Record<string, AccountInfoByNetwork> {
  const result: Record<string, AccountInfoByNetwork> = {};

  networkKeys.forEach((n) => {
    if (networkMetadataMap[n]) {
      result[n] = getAccountInfoByNetwork(address, n, networkMetadataMap[n]);
    }
  });

  return result;
}

function ChainBalances ({ address,
  className,
  currentNetworkKey,
  isShowBalanceDetail,
  isShowZeroBalances,
  networkBalanceMaps,
  networkKeys,
  networkMetadataMap,
  setIsExportModalOpen,
  setQrModalOpen,
  setSelectedNetworkBalance,
  setShowBalanceDetail,
  updateModalQr }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const accountInfoByNetworkMap: Record<string, AccountInfoByNetwork> =
    getAccountInfoByNetworkMap(address, networkKeys, networkMetadataMap);
  const [selectedNetworkKey, setSelectedNetworkKey] = useState<string>('');
  const [scrollWidth, setScrollWidth] = useState<number>(6);
  const [containerWidth, setContainerWidth] = useState<number>(458);
  const [listWidth, setListWidth] = useState<number>(452);
  const selectedInfo = accountInfoByNetworkMap[selectedNetworkKey];
  const selectedBalanceInfo = networkBalanceMaps[selectedNetworkKey];
  const { currentAccount: { account: currentAccount } } = useSelector((state: RootState) => state);
  const { networkMap } = useSelector((state: RootState) => state);
  const [connectingList, setConnectingList] = useState<Record<string, ConnectingState>>({});

  const isEthAccount = isEthereumAddress(currentAccount?.address);

  const _openBalanceDetail = useCallback((networkKey: string) => {
    setSelectedNetworkKey(networkKey);
    setShowBalanceDetail(true);
  }, [setShowBalanceDetail]);

  const _backToHome = useCallback(() => {
    setShowBalanceDetail(false);
  }, [setShowBalanceDetail]);

  const toggleBalanceDetail = useCallback((networkKey: string) => {
    if (networkKey === selectedNetworkKey) {
      setSelectedNetworkKey('');
    } else {
      setSelectedNetworkKey(networkKey);
    }
  }, [selectedNetworkKey]);

  const renderChainBalanceItem = (networkKey: string) => {
    const info = accountInfoByNetworkMap[networkKey];
    const balanceInfo = networkBalanceMaps[networkKey];

    if (!isAllowToShow(
      isShowZeroBalances,
      currentNetworkKey,
      networkKey,
      balanceInfo
    )) {
      return (<Fragment key={info.key} />);
    }

    const isConnecting = connectingList[networkKey]?.status === 'done' || (balanceInfo && balanceInfo.isLoading);

    if (balanceInfo && balanceInfo.childrenBalances.length === 0) {
      return (
        <ChainBalanceDetailItem
          accountInfo={info}
          balanceInfo={balanceInfo}
          isConnecting={isConnecting}
          isLoading={!balanceInfo}
          isShowDetail={info.networkKey === selectedNetworkKey}
          key={info.key}
          setIsExportModalOpen={setIsExportModalOpen}
          setQrModalOpen={setQrModalOpen}
          toggleBalanceDetail={toggleBalanceDetail}
          updateModalQr={updateModalQr}
        />
      );
    }

    return (
      <ChainBalanceItem
        accountInfo={info}
        balanceInfo={balanceInfo}
        isConnecting={isConnecting}
        isLoading={!balanceInfo}
        key={info.key}
        setIsExportModalOpen={setIsExportModalOpen}
        setQrModalOpen={setQrModalOpen}
        setSelectedNetworkBalance={setSelectedNetworkBalance}
        showBalanceDetail={_openBalanceDetail}
        updateModalQr={updateModalQr}
      />
    );
  };

  const getScrollbarWidth = () => {
    // Creating invisible container
    const outer = document.createElement('div');

    outer.style.visibility = 'hidden';
    outer.style.overflow = 'scroll'; // forcing scrollbar to appear
    // @ts-ignore
    outer.style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps
    document.body.appendChild(outer);
    // Creating inner element and placing it in the container
    const inner = document.createElement('div');

    outer.appendChild(inner);
    // Calculating difference between container's full width and the child width
    const scrollbarWidth = (outer.offsetWidth - inner.offsetWidth);

    // Removing temporary elements from the DOM
    document.body.removeChild(outer);
    setScrollWidth(scrollbarWidth);
  };

  const handlerResize = () => {
    const container = document.querySelector('.home-tab-contents') as HTMLElement;

    setContainerWidth(container.offsetWidth);
  };

  useEffect(() => {
    handlerResize();
    window.addEventListener('resize', handlerResize);

    return () => {
      window.removeEventListener('resize', handlerResize);
    };
  }, []);

  useEffect(() => {
    getScrollbarWidth();
  }, []);

  useEffect(() => {
    setListWidth(containerWidth - scrollWidth);
  }, [containerWidth, scrollWidth]);

  useEffect(() => {
    const checkData = () => {
      setConnectingList((state) => {
        const timestamp = +new Date();
        const newList: Record<string, ConnectingState> = {};

        Object.entries(networkMap).forEach(([key, value]) => {
          const isDisconnected = value.apiStatus !== NETWORK_STATUS.CONNECTED;

          if (isDisconnected) {
            if (state[key]) {
              newList[key] = state[key];
            } else {
              newList[key] = {
                status: 'pending',
                timestamp
              };
            }
          }
        });

        return newList;
      });
    };

    checkData();
  }, [networkMap]);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const createCounter = () => {
      const check = Object.values(connectingList).some((item) => item.status === 'pending');

      if (check) {
        timer = setInterval(() => {
          const newList: Record<string, ConnectingState> = {};
          const newTimestamp = +new Date();
          let changed = false;

          Object.entries(connectingList).forEach(([key, item]) => {
            if (item.status === 'pending' && newTimestamp - item.timestamp >= WAITING_FOR_CONNECTION) {
              newList[key] = { ...item, status: 'done' };
              !changed && (changed = true);
            } else {
              newList[key] = item;
            }
          });

          if (changed) {
            setConnectingList(newList);
          }
        }, 1000);
      }
    };

    createCounter();

    return () => {
      timer && clearInterval(timer);
    };
  }, [connectingList]);

  return (
    <div className={CN(className, 'chain-balances-container')}>
      {!isShowBalanceDetail || !selectedNetworkKey || !selectedInfo || !selectedBalanceInfo
        ? (
          <>
            <div
              className={CN('chain-balances-container__body')}
              style={{ width: listWidth }}
            >
              {networkKeys.map((networkKey) => renderChainBalanceItem(networkKey))}
            </div>
            {
              isEthAccount &&
              <div className='chain-balances-container__footer'>
                <div>
                  <div className='chain-balances-container__footer-row-1'>
                    {t<string>("Don't see your token?")}
                  </div>
                  <div className='chain-balances-container__footer-row-2'>
                    {/* <div className='chain-balances-container__footer-action'>{t<string>('Refresh list')}</div> */}
                    {/* <span>&nbsp;{t<string>('or')}&nbsp;</span> */}
                    <Link
                      className='chain-balances-container__footer-action'
                      to={'/account/import-evm-token'}
                    >
                      {t<string>('Import tokens')}
                    </Link>
                  </div>
                </div>
              </div>
            }
          </>
        )
        : (
          <>
            <ChainBalanceDetail
              accountInfo={selectedInfo}
              backToHome={_backToHome}
              balanceInfo={selectedBalanceInfo}
              isConnecting={connectingList[selectedInfo.networkKey]?.status === 'done'}
              setIsExportModalOpen={setIsExportModalOpen}
              setQrModalOpen={setQrModalOpen}
              setSelectedNetworkBalance={setSelectedNetworkBalance}
              updateModalQr={updateModalQr}
            />
          </>
        )
      }
    </div>
  );
}

export default React.memo(styled(ChainBalances)(({ theme }: Props) => `
  .chain-balances-container {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    max-height: 100%;
  }

  .chain-balances-container__body {
    overflow-y: auto;
  }

  .chain-balances-container__footer {
    height: 90px;
    display: flex;
    text-align: center;
    align-items: center;
    justify-content: center;
    color: ${theme.textColor2};
    font-size: 14px;
  }

  .chain-balances-container__footer-row-2 {
    display: flex;
    justify-content: center;

  }

  .chain-balances-container__footer-action {
    color: ${theme.buttonTextColor2};
    cursor: pointer;
  }
`));
