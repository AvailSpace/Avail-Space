// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { EmptyList, PageWrapper, TokenBalance, TokenItem, TokenPrice } from '@subwallet/extension-koni-ui/components';
import { AccountSelectorModal } from '@subwallet/extension-koni-ui/components/Modal/AccountSelectorModal';
import ReceiveQrModal from '@subwallet/extension-koni-ui/components/Modal/ReceiveModal/ReceiveQrModal';
import { TokensSelectorModal } from '@subwallet/extension-koni-ui/components/Modal/ReceiveModal/TokensSelectorModal';
import NoContent, { PAGE_TYPE } from '@subwallet/extension-koni-ui/components/NoContent';
import { TokenGroupBalanceItem } from '@subwallet/extension-koni-ui/components/TokenItem/TokenGroupBalanceItem';
import { DataContext } from '@subwallet/extension-koni-ui/contexts/DataContext';
import { HomeContext } from '@subwallet/extension-koni-ui/contexts/screen/HomeContext';
import { ScreenContext } from '@subwallet/extension-koni-ui/contexts/ScreenContext';
import useNotification from '@subwallet/extension-koni-ui/hooks/common/useNotification';
import useTranslation from '@subwallet/extension-koni-ui/hooks/common/useTranslation';
import useReceiveQR from '@subwallet/extension-koni-ui/hooks/screen/home/useReceiveQR';
import { UpperBlock } from '@subwallet/extension-koni-ui/Popup/Home/Tokens/UpperBlock';
import { RootState } from '@subwallet/extension-koni-ui/stores';
import { ThemeProps } from '@subwallet/extension-koni-ui/types';
import { TokenBalanceItemType } from '@subwallet/extension-koni-ui/types/balance';
import { sortTokenByValue } from '@subwallet/extension-koni-ui/utils';
import { Button, Icon, Number } from '@subwallet/react-ui';
import BigN from 'bignumber.js';
import classNames from 'classnames';
import { Coins, FadersHorizontal, SlidersHorizontal } from 'phosphor-react';
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useOutletContext } from 'react-router-dom';
import styled from 'styled-components';

import DetailTable from './DetailTable';

type Props = ThemeProps;
const BN_100 = new BigN(100);

const Component = (): React.ReactElement => {
  const { t } = useTranslation();
  const [isShrink, setIsShrink] = useState<boolean>(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const topBlockRef = useRef<HTMLDivElement>(null);
  const { accountBalance: { tokenGroupBalanceMap,
    totalBalanceInfo }, tokenGroupStructure: { sortedTokenGroups } } = useContext(HomeContext);
  const currentAccount = useSelector((state: RootState) => state.accountState.currentAccount);

  const outletContext: {
    searchInput: string,
    setSearchPlaceholder: React.Dispatch<React.SetStateAction<React.ReactNode>>
  } = useOutletContext();

  useEffect(() => {
    outletContext?.setSearchPlaceholder && outletContext.setSearchPlaceholder('Token name');
  }, [outletContext, outletContext?.setSearchPlaceholder]);

  const notify = useNotification();
  const { accountSelectorItems,
    onOpenReceive,
    openSelectAccount,
    openSelectToken,
    selectedAccount,
    selectedNetwork,
    tokenSelectorItems } = useReceiveQR();

  const { isWebUI } = useContext(ScreenContext);
  const handleScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    const topPosition = event.currentTarget.scrollTop;

    if (topPosition > 80) {
      setIsShrink((value) => {
        if (!value && topBlockRef.current && containerRef.current) {
          const containerProps = containerRef.current.getBoundingClientRect();

          topBlockRef.current.style.position = 'fixed';
          topBlockRef.current.style.top = `${Math.floor(containerProps.top)}px`;
          topBlockRef.current.style.left = `${containerProps.left}px`;
          topBlockRef.current.style.right = `${containerProps.right}px`;
          topBlockRef.current.style.width = `${containerProps.width}px`;
          topBlockRef.current.style.opacity = '0';
          topBlockRef.current.style.paddingTop = '0';

          setTimeout(() => {
            if (topBlockRef.current) {
              topBlockRef.current.style.opacity = '1';
              topBlockRef.current.style.paddingTop = '32px';
            }
          }, 100);
        }

        return true;
      });
    } else {
      setIsShrink((value) => {
        if (value && topBlockRef.current) {
          topBlockRef.current.style.position = 'absolute';
          topBlockRef.current.style.top = '0';
          topBlockRef.current.style.left = '0';
          topBlockRef.current.style.right = '0';
          topBlockRef.current.style.width = '100%';
          topBlockRef.current.style.opacity = '0';
          topBlockRef.current.style.paddingTop = '0';

          setTimeout(() => {
            if (topBlockRef.current) {
              topBlockRef.current.style.opacity = '1';
              topBlockRef.current.style.paddingTop = '32px';
            }
          }, 100);
        }

        return false;
      });
    }
  }, []);

  const handleResize = useCallback(() => {
    const topPosition = containerRef.current?.scrollTop || 0;

    if (topPosition > 80) {
      if (topBlockRef.current && containerRef.current) {
        const containerProps = containerRef.current.getBoundingClientRect();

        topBlockRef.current.style.top = `${Math.floor(containerProps.top)}px`;
        topBlockRef.current.style.left = `${containerProps.left}px`;
        topBlockRef.current.style.right = `${containerProps.right}px`;
        topBlockRef.current.style.width = `${containerProps.width}px`;
      }
    } else {
      if (topBlockRef.current) {
        topBlockRef.current.style.top = '0';
        topBlockRef.current.style.left = '0';
        topBlockRef.current.style.right = '0';
        topBlockRef.current.style.width = '100%';
      }
    }
  }, []);

  const isTotalBalanceDecrease = totalBalanceInfo.change.status === 'decrease';

  const onClickItem = useCallback((item: TokenBalanceItemType) => {
    navigate(`/home/tokens/detail/${item.slug}`);
  }, [navigate]);

  const onClickManageToken = useCallback(() => {
    navigate('/settings/tokens/manage');
  }, [navigate]);

  const onOpenSendFund = useCallback(() => {
    if (currentAccount && currentAccount.isReadOnly) {
      notify({
        message: t('The account you are using is watch-only, you cannot send assets with it'),
        type: 'info',
        duration: 3
      });

      return;
    }

    navigate('/transaction/send-fund');
  },
  [currentAccount, navigate, notify, t]
  );

  const onOpenBuyTokens = useCallback(() => {
    navigate('/buy-tokens');
  },
  [navigate]
  );

  const tokenGroupBalanceItems = useMemo<TokenBalanceItemType[]>(() => {
    const result: TokenBalanceItemType[] = [];

    sortedTokenGroups.forEach((tokenGroupSlug) => {
      if (tokenGroupBalanceMap[tokenGroupSlug]) {
        result.push(tokenGroupBalanceMap[tokenGroupSlug]);
      }
    });

    return result.sort(sortTokenByValue);
  }, [sortedTokenGroups, tokenGroupBalanceMap]);

  useEffect(() => {
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [handleResize]);

  const tokenBalanceClick = useCallback((item: TokenBalanceItemType) => {
    return () => {
      onClickItem(item);
    };
  }, [onClickItem]);

  if (isWebUI) {
    return (
      <div className='token-table'>
        {tokenGroupBalanceItems.length <= 0
          ? (
            <NoContent pageType={PAGE_TYPE.TOKEN} />
          )
          : (
            <DetailTable
              columns={[
                {
                  title: t<string>('Token name'),
                  dataIndex: 'name',
                  key: 'name',
                  render: (_, row) => {
                    return (
                      <TokenItem
                        chain={row.chain}
                        chainDisplayName={row.chainDisplayName || ''}
                        logoKey={row.logoKey}
                        slug={row.slug}
                        symbol={row.symbol}
                      />
                    );
                  }
                },
                {
                  title: t<string>('Portfolio %'),
                  dataIndex: 'percentage',
                  key: 'percentage',
                  className: '__percentage-col',
                  render: (_, row) => {
                    return (
                      <Number
                        decimal={0}
                        decimalOpacity={0.45}
                        suffix={'%'}
                        value={row.total.convertedValue.multipliedBy(BN_100).dividedBy(totalBalanceInfo.convertedValue)}
                      />
                    );
                  }
                },
                {
                  title: t<string>('Price'),
                  dataIndex: 'price',
                  key: 'price',
                  render: (_, row) => {
                    return (
                      <TokenPrice
                        pastValue={row.price24hValue}
                        priceChangeStatus={row.priceChangeStatus}
                        value={row.priceValue}
                      />
                    );
                  }
                },
                {
                  title: 'Balance',
                  dataIndex: 'balance',
                  key: 'balance',
                  render: (_, row) => {
                    return (
                      <TokenBalance
                        convertedValue={row.total.convertedValue}
                        symbol={row.symbol}
                        value={row.total.value}
                      />
                    );
                  }
                }
              ]}
              dataSource={tokenGroupBalanceItems}
              onClick={onClickItem}
            />

          )}
        <Button
          block
          icon={(
            <Icon
              phosphorIcon={SlidersHorizontal}
              size='md'
            />
          )}
          onClick={onClickManageToken}
          type='ghost'
        >
          {t('Manage token list')}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={'tokens-screen-container'}
      onScroll={handleScroll}
      ref={containerRef}
    >
      <div
        className={classNames('__upper-block-wrapper', {
          '-is-shrink': isShrink,
          '-decrease': isTotalBalanceDecrease
        })}
        ref={topBlockRef}
      >
        <UpperBlock
          isPriceDecrease={isTotalBalanceDecrease}
          isShrink={isShrink}
          onOpenBuyTokens={onOpenBuyTokens}
          onOpenReceive={onOpenReceive}
          onOpenSendFund={onOpenSendFund}
          totalChangePercent={totalBalanceInfo.change.percent}
          totalChangeValue={totalBalanceInfo.change.value}
          totalValue={totalBalanceInfo.convertedValue}
        />
      </div>
      <div
        className={'__scroll-container'}
      >
        {
          tokenGroupBalanceItems.map((item) => {
            return (
              <TokenGroupBalanceItem
                key={item.slug}
                {...item}
                onPressItem={tokenBalanceClick(item)}
              />
            );
          })
        }
        {
          !tokenGroupBalanceItems.length && (
            <EmptyList
              className={'__empty-list'}
              emptyMessage={t('Add tokens to get started.')}
              emptyTitle={t('No tokens found')}
              phosphorIcon={Coins}
            />
          )
        }
        <div className={'__scroll-footer'}>
          <Button
            icon={<Icon phosphorIcon={FadersHorizontal} />}
            onClick={onClickManageToken}
            size={'xs'}
            type={'ghost'}
          >
            {t('Manage tokens')}
          </Button>
        </div>
      </div>
      {
        !isWebUI && (
          <>
            <AccountSelectorModal
              items={accountSelectorItems}
              onSelectItem={openSelectAccount}
            />

            <TokensSelectorModal
              address={selectedAccount}
              items={tokenSelectorItems}
              onSelectItem={openSelectToken}
            />

            <ReceiveQrModal
              address={selectedAccount}
              selectedNetwork={selectedNetwork}
            />
          </>
        )
      }
    </div>
  );
};

type WrapperProps = ThemeProps & {
  searchInput?: string
}

const WrapperComponent = ({ className = '' }: WrapperProps): React.ReactElement<Props> => {
  const dataContext = useContext(DataContext);

  return (
    <PageWrapper
      className={`tokens ${className}`}
      resolve={dataContext.awaitStores(['price', 'chainStore', 'assetRegistry', 'balance'])}
    >
      <Component />
    </PageWrapper>
  );
};

const Tokens = styled(WrapperComponent)<WrapperProps>(({ theme: { extendToken, token } }: WrapperProps) => {
  return ({
    overflow: 'hidden',

    'token-table': {
      '.token-group-balance-item': {
        marginBottom: '0px !important'
      }
    },

    'td.__percentage-col': {
      verticalAlign: 'top',

      '.ant-number': {
        lineHeight: token.lineHeightLG,
        fontSize: token.fontSizeLG
      },

      '.ant-number .ant-typography': {
        fontSize: 'inherit !important',
        lineHeight: 'inherit',
        textAlign: 'end'
      }
    },

    '.__empty-list': {
      marginTop: token.marginSM,
      marginBottom: token.marginSM
    },

    '.tokens-screen-container': {
      height: '100%',
      color: token.colorTextLight1,
      fontSize: token.fontSizeLG,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      overflowX: 'hidden',
      paddingTop: 210
    },

    '.__scroll-container': {
      paddingLeft: token.size,
      paddingRight: token.size
    },

    '.__upper-block-wrapper': {
      backgroundColor: token.colorBgDefault,
      position: 'absolute',
      paddingTop: '32px',
      height: 210,
      zIndex: 10,
      top: 0,
      left: 0,
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      backgroundImage: extendToken.tokensScreenSuccessBackgroundColor,
      transition: 'opacity, padding-top 0.27s ease',

      '&.-is-shrink': {
        height: 104
      },

      '&.-decrease': {
        backgroundImage: extendToken.tokensScreenDangerBackgroundColor
      }
    },

    '.tokens-upper-block': {
      flex: 1
    },

    '.__scroll-footer': {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: token.size
    },

    '.token-group-balance-item': {
      marginBottom: token.sizeXS
    },

    '.__upper-block-wrapper.-is-shrink': {
      '.__static-block': {
        display: 'none'
      },

      '.__scrolling-block': {
        display: 'flex'
      }
    }
  });
});

export default Tokens;
