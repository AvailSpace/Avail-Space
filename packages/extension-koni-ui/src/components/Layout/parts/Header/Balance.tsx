// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ReceiveQrModal, TokensSelectorModal } from '@subwallet/extension-koni-ui/components/Modal';
import { AccountSelectorModal } from '@subwallet/extension-koni-ui/components/Modal/AccountSelectorModal';
import { BaseModal } from '@subwallet/extension-koni-ui/components/Modal/BaseModal';
import { PREDEFINED_BUY_TOKEN } from '@subwallet/extension-koni-ui/constants';
import { DataContext } from '@subwallet/extension-koni-ui/contexts/DataContext';
import { HomeContext } from '@subwallet/extension-koni-ui/contexts/screen/HomeContext';
import { BackgroundColorMap, WebUIContext } from '@subwallet/extension-koni-ui/contexts/WebUIContext';
import { useNotification, useReceiveQR, useTranslation } from '@subwallet/extension-koni-ui/hooks';
import { saveShowBalance } from '@subwallet/extension-koni-ui/messaging';
import BuyTokens from '@subwallet/extension-koni-ui/Popup/BuyTokens';
import Transaction from '@subwallet/extension-koni-ui/Popup/Transaction/Transaction';
import SendFund from '@subwallet/extension-koni-ui/Popup/Transaction/variants/SendFund';
import { RootState } from '@subwallet/extension-koni-ui/stores';
import { PhosphorIcon, ThemeProps } from '@subwallet/extension-koni-ui/types';
import { getAccountType } from '@subwallet/extension-koni-ui/utils';
import { Button, Icon, ModalContext, Number, Tag, Typography } from '@subwallet/react-ui';
import CN from 'classnames';
import { ArrowFatLinesDown, Eye, EyeSlash, PaperPlaneTilt, ShoppingCartSimple } from 'phosphor-react';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useParams } from 'react-router-dom';
import styled from 'styled-components';

const TRANSFER_FUND_MODAL = 'transfer-fund-modal';
const BUY_TOKEN_MODAL = 'buy-token-modal';

export type Props = ThemeProps

type Action = {
  label: string
  type: string
  icon: PhosphorIcon
  onClick?: () => void
  disabled?: boolean
}

function Component ({ className }: Props): React.ReactElement<Props> {
  const dataContext = useContext(DataContext);
  const { setBackground } = useContext(WebUIContext);
  const locationPathname = useLocation().pathname;
  const tokenGroupSlug = useParams()?.slug;
  const assetRegistryMap = useSelector((root: RootState) => root.assetRegistry.assetRegistry);
  const multiChainAssetMap = useSelector((state: RootState) => state.assetRegistry.multiChainAssetMap);
  const isShowBalance = useSelector((state: RootState) => state.settings.isShowBalance);

  const onChangeShowBalance = useCallback(() => {
    saveShowBalance(!isShowBalance).catch(console.error);
  }, [isShowBalance]);

  const _tokenGroupSlug = useMemo(() => {
    if (locationPathname && tokenGroupSlug) {
      if (locationPathname.includes('/home/tokens/detail/')) {
        return tokenGroupSlug;
      }
    }

    return undefined;
  }, [locationPathname, tokenGroupSlug]);

  const { t } = useTranslation();
  const { accountBalance: { totalBalanceInfo } } = useContext(HomeContext);
  const { activeModal, inactiveModal } = useContext(ModalContext);
  const { accountSelectorItems,
    onOpenReceive,
    openSelectAccount,
    openSelectToken,
    selectedAccount,
    selectedNetwork,
    tokenSelectorItems } = useReceiveQR(_tokenGroupSlug);

  const currentAccount = useSelector((state: RootState) => state.accountState.currentAccount);
  const [sendFundKey, setSendFundKey] = useState<string>('sendFundKey');
  const [buyTokensKey, setBuyTokensKey] = useState<string>('buyTokensKey');
  const notify = useNotification();

  const isTotalBalanceDecrease = totalBalanceInfo.change.status === 'decrease';
  const totalChangePercent = totalBalanceInfo.change.percent;
  const totalChangeValue = totalBalanceInfo.change.value;
  const totalValue = totalBalanceInfo.convertedValue;

  const accounts = useSelector((state: RootState) => state.accountState.accounts);
  const isAllAccount = useSelector((state: RootState) => state.accountState.isAllAccount);

  const onOpenBuyTokens = useCallback(() => {
    activeModal(BUY_TOKEN_MODAL);
  }, [activeModal]);

  useEffect(() => {
    dataContext.awaitStores(['price', 'chainStore', 'assetRegistry', 'balance']).catch(console.error);
  }, [dataContext]);

  const onOpenSendFund = useCallback(() => {
    if (currentAccount && currentAccount.isReadOnly) {
      notify({
        message: t('The account you are using is read-only, you cannot send assets with it'),
        type: 'info',
        duration: 3
      });

      return;
    }

    activeModal(TRANSFER_FUND_MODAL);
  },
  [currentAccount, notify, t, activeModal]
  );

  useEffect(() => {
    setSendFundKey(`sendFundKey-${Date.now()}`);
    setBuyTokensKey(`buyTokensKey-${Date.now()}`);
  }, [locationPathname]);

  useEffect(() => {
    const backgroundColor = isTotalBalanceDecrease ? BackgroundColorMap.DECREASE : BackgroundColorMap.INCREASE;

    setBackground(backgroundColor);
  }, [isTotalBalanceDecrease, setBackground]);

  const buyTokenSymbol = useMemo<string>(() => {
    if (tokenGroupSlug) {
      if (multiChainAssetMap[tokenGroupSlug]) {
        return multiChainAssetMap[tokenGroupSlug].symbol;
      }

      if (assetRegistryMap[tokenGroupSlug]) {
        return assetRegistryMap[tokenGroupSlug].symbol;
      }
    }

    return '';
  }, [tokenGroupSlug, assetRegistryMap, multiChainAssetMap]);

  const handleCancelTransfer = useCallback(() => {
    inactiveModal(TRANSFER_FUND_MODAL);
    setSendFundKey(`sendFundKey-${Date.now()}`);
  }, [inactiveModal]);

  const handleCancelBuy = useCallback(() => {
    inactiveModal(BUY_TOKEN_MODAL);
    setBuyTokensKey(`buyTokensKey-${Date.now()}`);
  }, [inactiveModal]);

  const isSupportBuyTokens = useMemo(() => {
    if (!locationPathname.includes('/home/tokens/detail/')) {
      return true;
    }

    const buyInfo = PREDEFINED_BUY_TOKEN[buyTokenSymbol];

    if (buyInfo) {
      const supportType = buyInfo.support;

      if (isAllAccount) {
        for (const account of accounts) {
          if (supportType === getAccountType(account.address)) {
            return true;
          }
        }
      } else {
        if (currentAccount?.address && (supportType === getAccountType(currentAccount?.address))) {
          return true;
        }
      }
    }

    return false;
  }, [locationPathname, buyTokenSymbol, isAllAccount, accounts, currentAccount?.address]);

  const actions: Action[] = [
    {
      label: 'Receive',
      type: 'receive',
      icon: ArrowFatLinesDown,
      onClick: onOpenReceive
    },
    {
      label: 'Send',
      type: 'send',
      icon: PaperPlaneTilt,
      onClick: onOpenSendFund
    },
    {
      label: 'Buy',
      type: 'buys',
      icon: ShoppingCartSimple,
      onClick: onOpenBuyTokens,
      disabled: !isSupportBuyTokens
    }
  ];

  return (
    <div className={CN(className, 'flex-row')}>
      <div className={CN('__block-item', '__total-balance-block')}>
        <div className={'__block-title-wrapper'}>
          <div className={'__block-title'}>{t('Total balance')}</div>

          <Button
            className='__balance-visibility-toggle'
            icon={
              <Icon
                phosphorIcon={isShowBalance ? Eye : EyeSlash}
              />
            }
            onClick={onChangeShowBalance}
            size={'xs'}
            type='ghost'
          />
        </div>

        <div className={'__block-content'}>
          <Number
            className={'__balance-value'}
            decimal={0}
            decimalOpacity={0.45}
            hide={!isShowBalance}
            prefix='$'
            subFloatNumber
            value={totalValue}
          />

          <div className={'__balance-change-container'}>
            <Number
              className={'__balance-change-value'}
              decimal={0}
              decimalOpacity={1}
              hide={!isShowBalance}
              prefix={isTotalBalanceDecrease ? '- $' : '+ $'}
              value={totalChangeValue}
            />
            <Tag
              className={`__balance-change-percent ${isTotalBalanceDecrease ? '-decrease' : ''}`}
              shape={'round'}
            >
              <Number
                decimal={0}
                decimalOpacity={1}
                hide={!isShowBalance}
                prefix={isTotalBalanceDecrease ? '-' : '+'}
                suffix={'%'}
                value={totalChangePercent}
                weight={700}
              />
            </Tag>
          </div>
        </div>
      </div>

      <div
        className='__block-divider'
      />

      <div className={CN('__block-item', '__balance-block')}>
        <div className='__block-title-wrapper'>
          <div className={'__block-title'}>{t('Transferable balance')}</div>
        </div>

        <div className={'__block-content'}>
          <Number
            className='__balance-value'
            decimal={0}
            decimalOpacity={0.45}
            hide={!isShowBalance}
            prefix='$'
            subFloatNumber
            value={totalBalanceInfo.freeValue}
          />
        </div>
      </div>

      <div
        className='__block-divider'
      />

      <div className={CN('__block-item', '__balance-block')}>
        <div className='__block-title-wrapper'>
          <div className={'__block-title'}>{t('Locked balance')}</div>
        </div>

        <div className={'__block-content'}>
          <Number
            className='__balance-value'
            decimal={0}
            decimalOpacity={0.45}
            hide={!isShowBalance}
            prefix='$'
            subFloatNumber
            value={totalBalanceInfo.lockedValue}
          />
        </div>
      </div>

      <div
        className='__block-divider'
      />

      <div className={CN('__block-item', '__action-block')}>
        <div className='__block-title-wrapper'>
          <div className={'__block-title'}>{t('Actions')}</div>
        </div>

        <div className={'__block-content'}>
          {actions.map((item) => (
            <div
              className='__action-button'
              key={item.type}
            >
              <Button
                className={CN(`type-${item.type}`)}
                disabled={item.disabled}
                icon={(
                  <Icon
                    phosphorIcon={item.icon}
                    size='md'
                    weight='duotone'
                  />
                )}
                onClick={item.onClick}
                shape='squircle'
                size='sm'
              />
              <Typography.Text>{item.label}</Typography.Text>
            </div>
          ))}
        </div>
      </div>

      <BaseModal
        className={'right-side-modal'}
        id={TRANSFER_FUND_MODAL}
        onCancel={handleCancelTransfer}
        title={t('Transfer')}
      >
        <Transaction
          key={sendFundKey}
          modalContent
        >
          <SendFund
            modalContent
            tokenGroupSlug={_tokenGroupSlug}
          />
        </Transaction>
      </BaseModal>

      <BaseModal
        className={'right-side-modal'}
        id={BUY_TOKEN_MODAL}
        onCancel={handleCancelBuy}
        title={t('Buy token')}
      >
        <BuyTokens
          key={buyTokensKey}
          modalContent
          slug={buyTokenSymbol}
        />
      </BaseModal>

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
    </div>
  );
}

const Balance = styled(Component)<Props>(({ theme: { token } }: Props) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'stretch',
  marginTop: 24,
  marginBottom: 56,

  '.ant-number .ant-typography': {
    fontSize: 'inherit !important',
    fontWeight: 'inherit !important',
    lineHeight: 'inherit'
  },

  '.__block-title': {
    fontSize: token.fontSize,
    lineHeight: token.lineHeight
  },

  '.__balance-value': {
    fontWeight: token.headingFontWeight,

    '.ant-number-decimal': {
      fontSize: '24px !important',
      lineHeight: '32px !important'
    }
  },

  '.__block-divider': {
    height: 116,
    width: 1,
    backgroundColor: token.colorBgDivider,
    marginTop: token.marginSM
  },

  '.__balance-change-container': {
    display: 'flex',
    justifyContent: 'start',
    alignItems: 'center',
    marginTop: token.marginSM
  },

  '.__balance-change-value': {
    marginRight: token.sizeXS,
    lineHeight: token.lineHeight
  },

  '.__balance-change-percent': {
    backgroundColor: token['cyan-6'],
    color: token['green-1'],
    marginInlineEnd: 0,
    display: 'flex',

    '&.-decrease': {
      backgroundColor: token.colorError,
      color: token.colorTextLight1
    },

    '.ant-number': {
      fontSize: token.fontSizeXS
    }
  },

  '.__block-item': {
    display: 'flex',
    flexDirection: 'column',
    flex: 1
  },

  '.__block-title-wrapper': {
    display: 'flex',
    gap: token.sizeXS,
    minHeight: 40,
    marginBottom: token.marginXS,
    alignItems: 'center'
  },

  '.__total-balance-block': {
    '.__balance-value': {
      fontSize: 38,
      lineHeight: '46px'
    }
  },

  '.__balance-block': {
    alignItems: 'center',

    '.__balance-value': {
      fontSize: 30,
      lineHeight: '38px'
    }
  },

  '.__action-block': {
    alignItems: 'center',

    '.__block-content': {
      display: 'flex',
      gap: token.sizeSM
    }
  },

  '.__action-button': {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: token.sizeSM,

    '.ant-squircle': {
      marginLeft: 6,
      marginRight: 6
    }
  }
}));

export default Balance;
