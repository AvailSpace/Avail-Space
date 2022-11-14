// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ChainRegistry, DropdownTransformOptionType, NetworkJson } from '@subwallet/extension-base/background/KoniTypes';
import { SupportedCrossChainsMap } from '@subwallet/extension-koni-base/api/xcm/utils';
import { AccountContext, ActionContext, Button, Warning } from '@subwallet/extension-koni-ui/components';
import InputBalance from '@subwallet/extension-koni-ui/components/InputBalance';
import LoadingContainer from '@subwallet/extension-koni-ui/components/LoadingContainer';
import ReceiverInputAddress from '@subwallet/extension-koni-ui/components/ReceiverInputAddress';
import { useTranslation } from '@subwallet/extension-koni-ui/components/translate';
import { BalanceFormatType, XcmTransferInputAddressType } from '@subwallet/extension-koni-ui/components/types';
import useFreeBalance from '@subwallet/extension-koni-ui/hooks/screen/sending/useFreeBalance';
import useGetAccountByAddress from '@subwallet/extension-koni-ui/hooks/useGetAccountByAddress';
import { checkCrossChainTransfer } from '@subwallet/extension-koni-ui/messaging';
import Header from '@subwallet/extension-koni-ui/partials/Header';
import SendFundResult from '@subwallet/extension-koni-ui/Popup/Sending/SendFundResult';
import { getBalanceFormat, getDefaultAddress, getMainTokenInfo } from '@subwallet/extension-koni-ui/Popup/Sending/utils';
import AuthTransaction from '@subwallet/extension-koni-ui/Popup/XcmTransfer/AuthTransaction';
import BridgeInputAddress from '@subwallet/extension-koni-ui/Popup/XcmTransfer/BridgeInputAddress';
import Dropdown from '@subwallet/extension-koni-ui/Popup/XcmTransfer/XcmDropdown/Dropdown';
import { RootState } from '@subwallet/extension-koni-ui/stores';
import { ThemeProps, TransferResultType } from '@subwallet/extension-koni-ui/types';
import { findAccountByAddress } from '@subwallet/extension-koni-ui/util/account';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { BN, BN_ZERO } from '@polkadot/util';
import { isEthereumAddress } from '@polkadot/util-crypto';

import arrowRight from '../../assets/arrow-right.svg';

interface Props extends ThemeProps {
  className?: string,
}

interface ContentProps extends ThemeProps {
  className?: string;
  defaultValue: XcmTransferInputAddressType;
  networkMap: Record<string, NetworkJson>;
  chainRegistryMap: Record<string, ChainRegistry>;
  originChainOptions: DropdownTransformOptionType[];
  firstOriginChain: string;
}

function getDestinationChainOptions (originChain: string, networkMap: Record<string, NetworkJson>) {
  return Object.keys(SupportedCrossChainsMap[originChain].relationMap).map((key) => ({ label: networkMap[key].chain, value: key }));
}

function getSupportedTokens (originChain: string, destinationChain: string): string[] {
  return SupportedCrossChainsMap[originChain].relationMap[destinationChain].supportedToken;
}

// function filterOriginChainOptions (isAccountEvm: boolean, supportedCrossChainsMap: Record<string, CrossChainRelation>, networkMap: Record<string, NetworkJson>) {
//   const filteredOptions: DropdownTransformOptionType[] = [];
//
//   Object.entries(supportedCrossChainsMap).forEach(([key, item]) => {
//     if (item.isEthereum === isAccountEvm) {
//       filteredOptions.push({ label: networkMap[key].chain, value: key });
//     }
//   });
//
//   return filteredOptions;
// }

enum BLOCK_HARDWARE_STATE {
  ACCEPTED,
  BLOCK_CHAIN,
  WRONG_CHAIN
}

const SUPPORT_LEDGER_XCM: string[] = [];

function Wrapper ({ className = '', theme }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { accounts } = useContext(AccountContext);
  const { chainRegistry: chainRegistryMap,
    currentAccount: { account },
    networkMap } = useSelector((state: RootState) => state);
  // const isAccountEvm = useIsAccountEvm();
  const originChainOptions = Object.keys(SupportedCrossChainsMap).map((key) => ({ label: networkMap[key].chain, value: key }));
  const firstOriginChain = originChainOptions[0].value;
  const destinationChainList = Object.keys(SupportedCrossChainsMap[firstOriginChain].relationMap);
  let defaultValue;

  if (account) {
    defaultValue = {
      address: getDefaultAddress(account.address, accounts),
      token: SupportedCrossChainsMap[firstOriginChain].relationMap[destinationChainList[0]].supportedToken[0]
    };
  } else {
    defaultValue = null;
  }

  return (
    <div className={className}>
      <Header
        isShowNetworkSelect={false}
        showAdd
        showCancelButton
        showSearch
        showSettings
        showSubHeader
        subHeaderName={t<string>('XCM Transfer')}
      />
      {accounts && accounts.length && account && defaultValue
        ? (
          <XcmTransfer
            chainRegistryMap={chainRegistryMap}
            className='bridge-container'
            defaultValue={defaultValue}
            firstOriginChain={firstOriginChain}
            networkMap={networkMap}
            originChainOptions={originChainOptions}
            theme={theme}
          />
        )
        : (<LoadingContainer />)
      }
    </div>
  );
}

function XcmTransfer ({ chainRegistryMap, className, defaultValue, firstOriginChain, networkMap, originChainOptions }: ContentProps): React.ReactElement {
  const { t } = useTranslation();
  const [isShowTxModal, setShowTxModal] = useState<boolean>(false);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [amount, setAmount] = useState<BN | undefined>(BN_ZERO);
  const [originChain, setOriginChain] = useState<string>(firstOriginChain);
  const [{ address: senderId,
    token: selectedToken }, setSenderValue] = useState<XcmTransferInputAddressType>(defaultValue);
  // const [isTransferAll, setIsTransferAll] = useState(false);
  // const [existentialDeposit, setExistentialDeposit] = useState<string>('0');
  // const [estimatedFee, setEstimatedFee] = useState('0');
  // const [feeSymbol, setFeeSymbol] = useState<string | undefined>(undefined);
  const onAction = useContext(ActionContext);

  const { accounts } = useContext(AccountContext);

  const [feeString, setFeeString] = useState<string | undefined>();
  const senderFreeBalance = useFreeBalance(originChain, senderId, selectedToken);
  const recipientFreeBalance = useFreeBalance(originChain, recipientId, selectedToken);

  // const maxTransfer = getXcmMaxTransfer(estimatedFee, feeSymbol, selectedToken, networkMap[originChain].nativeToken as string, senderFreeBalance, existentialDeposit);

  const [txResult, setTxResult] = useState<TransferResultType>({ isShowTxResult: false, isTxSuccess: false });
  const { isShowTxResult } = txResult;
  const balanceFormat: BalanceFormatType | null = chainRegistryMap[originChain] && networkMap[originChain].active
    ? getBalanceFormat(originChain, selectedToken, chainRegistryMap)
    : null;
  const mainTokenInfo = chainRegistryMap[originChain] && networkMap[originChain].active ? getMainTokenInfo(originChain, chainRegistryMap) : null;
  // const valueToTransfer = isTransferAll && maxTransfer ? maxTransfer.toString() : amount?.toString() || '0';
  const valueToTransfer = amount?.toString() || '0';
  const defaultDestinationChainOptions = getDestinationChainOptions(firstOriginChain, networkMap);
  const [[selectedDestinationChain, destinationChainOptions], setDestinationChain] = useState<[string, DropdownTransformOptionType[]]>([defaultDestinationChainOptions[0].value, defaultDestinationChainOptions]);
  const tokenList = getSupportedTokens(originChain, selectedDestinationChain).map((token) => (
    {
      label: token,
      value: token,
      networkKey: originChain,
      networkName: networkMap[originChain].chain
    }
  ));
  const checkOriginChainAndSenderIdType = !!networkMap[originChain].isEthereum === isEthereumAddress(senderId);
  const checkDestinationChainAndReceiverIdType = !!recipientId && !!networkMap[selectedDestinationChain].isEthereum === isEthereumAddress(recipientId);
  const amountGtAvailableBalance = amount && senderFreeBalance && amount.gt(new BN(senderFreeBalance));

  const accountBlockHardwareState = useCallback((address: string | null, chain: string, isReceiver?: boolean): BLOCK_HARDWARE_STATE => {
    if (address) {
      const account = findAccountByAddress(accounts, address);

      if (!account) {
        return BLOCK_HARDWARE_STATE.ACCEPTED;
      } else {
        if (account.isHardware) {
          const network = networkMap[chain];

          if (!network) {
            return BLOCK_HARDWARE_STATE.BLOCK_CHAIN;
          } else {
            if (SUPPORT_LEDGER_XCM.includes(network.key) || isReceiver) {
              return (account.originGenesisHash === network.genesisHash) ? BLOCK_HARDWARE_STATE.ACCEPTED : BLOCK_HARDWARE_STATE.WRONG_CHAIN;
            } else {
              return BLOCK_HARDWARE_STATE.BLOCK_CHAIN;
            }
          }
        } else {
          return BLOCK_HARDWARE_STATE.ACCEPTED;
        }
      }
    }

    return BLOCK_HARDWARE_STATE.ACCEPTED;
  }, [accounts, networkMap]);

  const senderAccount = useGetAccountByAddress(senderId);

  const isReadOnly = useMemo((): boolean => {
    if (!senderAccount) {
      return false;
    } else {
      return !!senderAccount.isReadOnly;
    }
  }, [senderAccount]);

  const senderBlockHardwareState = useMemo((): BLOCK_HARDWARE_STATE => {
    return accountBlockHardwareState(senderId, originChain);
  }, [accountBlockHardwareState, originChain, senderId]);

  const receiverBlockHardwareState = useMemo((): BLOCK_HARDWARE_STATE => {
    return accountBlockHardwareState(recipientId, selectedDestinationChain, true);
  }, [accountBlockHardwareState, recipientId, selectedDestinationChain]);

  const canMakeTransfer = checkOriginChainAndSenderIdType &&
    checkDestinationChainAndReceiverIdType &&
    !!valueToTransfer &&
    !!recipientId &&
    !amountGtAvailableBalance &&
    senderBlockHardwareState === BLOCK_HARDWARE_STATE.ACCEPTED &&
    receiverBlockHardwareState === BLOCK_HARDWARE_STATE.ACCEPTED &&
    !!balanceFormat &&
    !isReadOnly;

  const getLedgerXCMText = useCallback((state: BLOCK_HARDWARE_STATE, isSender: boolean) => {
    let accountMessage: string;

    if (isSender) {
      accountMessage = t('The sender account is Ledger account.');
    } else {
      accountMessage = t('The receiver account is Ledger account.');
    }

    let stateMessage: string;

    switch (state) {
      case BLOCK_HARDWARE_STATE.BLOCK_CHAIN:
        stateMessage = t('This is not support XCM Transfer.');
        break;
      case BLOCK_HARDWARE_STATE.WRONG_CHAIN:
        stateMessage = t('The network not match.');
        break;
      default:
        stateMessage = '';
        break;
    }

    return [accountMessage, stateMessage].join(' ');
  }, [t]);

  // useEffect(() => {
  //   let isSync = true;
  //
  //   transferGetExistentialDeposit({ networkKey: originChain, token: selectedToken })
  //     .then((rs) => {
  //       if (isSync) {
  //         setExistentialDeposit(rs);
  //       }
  //     }).catch((e) => console.log('There is problem when transferGetExistentialDeposit', e));
  //
  //   return () => {
  //     isSync = false;
  //     setExistentialDeposit('0');
  //   };
  // }, [originChain, selectedToken]);

  useEffect(() => {
    let isSync = true;

    if (recipientId) {
      checkCrossChainTransfer({
        originNetworkKey: originChain,
        destinationNetworkKey: selectedDestinationChain,
        from: senderId,
        to: recipientId,
        token: selectedToken,
        value: valueToTransfer
      }).then((value) => {
        if (isSync) {
          setFeeString(value.feeString);
          // setFeeSymbol(value.feeSymbol);
          // setEstimatedFee(value.estimatedFee);
        }
      }).catch((e) => {
        console.log('err--------', e);

        // todo: find better way to handle the error
      });
    }

    return () => {
      isSync = false;
    };
  }, [recipientId, valueToTransfer, selectedToken, senderId, selectedDestinationChain, originChain]);

  const _onCancel = useCallback(
    () => {
      window.localStorage.setItem('popupNavigation', '/');
      onAction('/');
    },
    [onAction]
  );
  const _onTransfer = useCallback(() => {
    setShowTxModal(true);
  }, []);

  const _onChangeResult = useCallback((txResult: TransferResultType) => {
    setTxResult(txResult);
    setShowTxModal(false);
  }, []);

  const _onCancelTx = useCallback(() => {
    setShowTxModal(false);
  }, []);

  const _onResend = useCallback(() => {
    setTxResult({
      isTxSuccess: false,
      isShowTxResult: false,
      txError: undefined
    });
    setSenderValue({ address: senderId, token: selectedToken });
    setRecipientId(null);
  },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [
    originChain,
    selectedToken,
    senderId
  ]);

  const _onChangeOriginChain = useCallback((originChain: string) => {
    const destinationChainOptions = getDestinationChainOptions(originChain, networkMap);

    setOriginChain(originChain);
    setDestinationChain([destinationChainOptions[0].value, destinationChainOptions]);
    setSenderValue((prev) => {
      return {
        ...prev,
        token: getSupportedTokens(originChain, destinationChainOptions[0].value)[0]
      };
    });
  }, [networkMap]);

  const _onChangeDestinationChain = useCallback((chain: string) => {
    setDestinationChain((prev) => {
      return [chain, prev[1]];
    });

    setSenderValue((prev) => {
      return {
        ...prev,
        token: getSupportedTokens(originChain, chain)[0]
      };
    });
  }, [originChain]);

  return (
    <>
      {!isShowTxResult
        ? (
          <div className={className}>
            <div className='bridge__chain-selector-area'>
              <Dropdown
                className='bridge__chain-selector'
                isDisabled={false}
                label={'Origin Chain'}
                onChange={_onChangeOriginChain}
                options={originChainOptions}
                value={originChain}
              />

              <div className='bridge__chain-swap'>
                <img
                  alt='Icon'
                  src={arrowRight}
                />
              </div>

              <Dropdown
                className='bridge__chain-selector'
                isDisabled={false}
                label={'Destination Chain'}
                onChange={_onChangeDestinationChain}
                options={destinationChainOptions}
                value={selectedDestinationChain}
              />
            </div>

            {balanceFormat
              ? <>
                <BridgeInputAddress
                  balance={senderFreeBalance}
                  balanceFormat={balanceFormat}
                  chainRegistryMap={chainRegistryMap}
                  className=''
                  initValue={{
                    address: senderId,
                    token: selectedToken
                  }}
                  networkKey={originChain}
                  networkMap={networkMap}
                  onChange={setSenderValue}
                  options={tokenList}
                />

                <ReceiverInputAddress
                  balance={recipientFreeBalance}
                  balanceFormat={balanceFormat}
                  className={''}
                  inputAddressHelp={t<string>('The account you want to transfer to.')}
                  inputAddressLabel={t<string>('Destination Account')}
                  networkKey={originChain}
                  networkMap={networkMap}
                  onchange={setRecipientId}
                />

                {/* { */}
                {/*  isTransferAll && maxTransfer */}
                {/*    ? <InputBalance */}
                {/*      autoFocus */}
                {/*      className={'bridge-amount-input'} */}
                {/*      decimals={balanceFormat[0]} */}
                {/*      defaultValue={valueToTransfer} */}
                {/*      help={t<string>('The full account balance to be transferred, minus the transaction fees and the existential deposit')} */}
                {/*      isDisabled */}
                {/*      key={maxTransfer?.toString()} */}
                {/*      label={t<string>('maximum transferable')} */}
                {/*      siDecimals={balanceFormat[0]} */}
                {/*      siSymbol={balanceFormat[2] || balanceFormat[1]} */}
                {/*    /> */}
                {/*    : <InputBalance */}
                {/*      autoFocus */}
                {/*      className={'bridge-amount-input'} */}
                {/*      decimals={balanceFormat[0]} */}
                {/*      help={t<string>('Type the amount you want to transfer. Note that you can select the unit on the right e.g sending 1 milli is equivalent to sending 0.001.')} */}
                {/*      isError={false} */}
                {/*      isZeroable */}
                {/*      label={t<string>('amount')} */}
                {/*      onChange={setAmount} */}
                {/*      placeholder={'0'} */}
                {/*      siDecimals={balanceFormat[0]} */}
                {/*      siSymbol={balanceFormat[2] || balanceFormat[1]} */}
                {/*    /> */}
                {/* } */}

                <InputBalance
                  autoFocus
                  className={'bridge-amount-input'}
                  decimals={balanceFormat[0]}
                  help={t<string>('Type the amount you want to transfer. Note that you can select the unit on the right e.g sending 1 milli is equivalent to sending 0.001.')}
                  isError={false}
                  isZeroable
                  label={t<string>('amount')}
                  onChange={setAmount}
                  placeholder={'0'}
                  siDecimals={balanceFormat[0]}
                  siSymbol={balanceFormat[2] || balanceFormat[1]}
                />
                {!checkOriginChainAndSenderIdType &&
                <Warning
                  className='xcm-transfer-warning'
                  isDanger
                >
                  {t<string>(`Origin account must be ${networkMap[originChain].isEthereum ? 'EVM' : 'substrate'} type`)}
                </Warning>
                }

                {!!recipientId && !checkDestinationChainAndReceiverIdType &&
                <Warning
                  className='xcm-transfer-warning'
                  isDanger
                >
                  {t<string>(`Destination account must be ${networkMap[selectedDestinationChain].isEthereum ? 'EVM' : 'substrate'} type`)}
                </Warning>
                }

                {amountGtAvailableBalance && (
                  <Warning
                    className={'send-fund-warning'}
                    isDanger
                  >
                    {t<string>('The amount you want to transfer is greater than your available balance.')}
                  </Warning>
                )}
                {senderBlockHardwareState !== BLOCK_HARDWARE_STATE.ACCEPTED && (
                  <Warning
                    className={'xcm-transfer-warning'}
                    isDanger
                  >
                    {getLedgerXCMText(senderBlockHardwareState, true)}
                  </Warning>
                )}
                {receiverBlockHardwareState !== BLOCK_HARDWARE_STATE.ACCEPTED && (
                  <Warning
                    className={'xcm-transfer-warning'}
                    isDanger
                  >
                    {getLedgerXCMText(receiverBlockHardwareState, false)}
                  </Warning>
                )}
                {isReadOnly && (
                  <Warning
                    className='xcm-transfer-warning'
                    isDanger
                  >
                    {t<string>('The account you are using is read-only, you cannot send assets with it')}
                  </Warning>
                )}
              </>
              : <Warning className='xcm-transfer-warning'>
                {t<string>('To perform the transaction, please make sure the selected network in Origin Chain is activated first.')}
              </Warning>
            }

            {/* <div className={'send-fund-toggle'}> */}
            {/*  <Toggle */}
            {/*    className='typeToggle' */}
            {/*    label={t<string>('Transfer all')} */}
            {/*    onChange={setIsTransferAll} */}
            {/*    value={isTransferAll} */}
            {/*  /> */}
            {/* </div> */}

            <div className='bridge-button-container'>
              <Button
                className='bridge-button'
                onClick={_onCancel}
              >
                <span>
                  {t<string>('Cancel')}
                </span>
              </Button>

              <Button
                className='bridge-button'
                isDisabled={!canMakeTransfer}
                onClick={_onTransfer}
              >
                <span>
                  {t<string>('Transfer')}
                </span>
              </Button>
            </div>

            {isShowTxModal && mainTokenInfo && (
              <AuthTransaction
                balanceFormat={balanceFormat}
                destinationChainOptions={destinationChainOptions}
                feeString={feeString}
                networkMap={networkMap}
                onCancel={_onCancelTx}
                onChangeResult={_onChangeResult}
                originChainOptions={originChainOptions}
                requestPayload={{
                  from: senderId,
                  to: recipientId,
                  originNetworkKey: originChain,
                  destinationNetworkKey: selectedDestinationChain,
                  value: valueToTransfer,
                  token: selectedToken
                }}
              />
            )}
          </div>
        )
        : (
          <SendFundResult
            isXcmTransfer={true}
            networkKey={originChain}
            onResend={_onResend}
            txResult={txResult}
          />
        )
      }
    </>
  );
}

export default React.memo(styled(Wrapper)(({ theme }: Props) => `
  display: flex;
  flex: 1;
  overflow-y: auto;
  flex-direction: column;

  .send-fund-toggle {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
    margin-bottom: 20px;
  }

  .sub-header__cancel-btn {
    display: none;
  }

  .bridge-container {
    padding: 10px 22px 15px;
    flex: 1;
    overflow-y: auto;
  }

  .bridge-amount-input {
    margin-bottom: 10px;
    margin-top: 15px;
  }

  .bridge__chain-selector-area {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    margin-bottom: 15px;
  }

  .bridge__chain-swap {
    min-width: 40px;
    width: 40px;
    height: 40px;
    border-radius: 40%;
    border: 2px solid ${theme.buttonBorderColor};
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 30px 12px 0;
  }

  .bridge-button-container {
    display: flex;
    position: sticky;
    bottom: -15px;
    padding: 15px 22px;
    margin-left: -22px;
    margin-bottom: -15px;
    margin-right: -22px;
    background-color: ${theme.background};
  }

  .bridge__chain-selector {
    flex: 1;
  }

  .bridge__chain-selector .label-wrapper {
    margin-bottom: 5px;
  }

  .bridge__chain-selector label {
    font-size: 15px;
    text-transform: none;
    color: ${theme.textColor};
    line-height: 26px;
    font-weight: 500;
  }

  .bridge-button {
    flex: 1;
  }

  .bridge-button:first-child {
    background-color: ${theme.buttonBackground1};
    margin-right: 8px;

    span {
      color: ${theme.buttonTextColor2};
    }
  }

  .bridge-button:last-child {
    margin-left: 8px;
  }

  .xcm-transfer-warning {
    margin-bottom: 10px;
  }
`));
