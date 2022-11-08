// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { LedgerState } from '@subwallet/extension-base/../../../../extension-koni-base/src/signers/types';
import { BasicTxError, BasicTxResponse, DropdownTransformOptionType, NetworkJson, RequestCheckCrossChainTransfer, TransferStep } from '@subwallet/extension-base/background/KoniTypes';
import arrowRight from '@subwallet/extension-koni-ui/assets/arrow-right.svg';
import { InputWithLabel, Warning } from '@subwallet/extension-koni-ui/components';
import Button from '@subwallet/extension-koni-ui/components/Button';
import FormatBalance from '@subwallet/extension-koni-ui/components/FormatBalance';
import InputAddress from '@subwallet/extension-koni-ui/components/InputAddress';
import LedgerRequest from '@subwallet/extension-koni-ui/components/Signing/Ledger/LedgerRequest';
import Modal from '@subwallet/extension-koni-ui/components/Modal';
import QrRequest from '@subwallet/extension-koni-ui/components/Signing/QR/QrRequest';
import { BalanceFormatType } from '@subwallet/extension-koni-ui/components/types';
import { SIGN_MODE } from '@subwallet/extension-koni-ui/constants/signing';
import { ExternalRequestContext } from '@subwallet/extension-koni-ui/contexts/ExternalRequestContext';
import { QrSignerContext, QrContextState, QrStep } from '@subwallet/extension-koni-ui/contexts/QrSignerContext';
import useGetAccountByAddress from '@subwallet/extension-koni-ui/hooks/useGetAccountByAddress';
import { useGetSignMode } from '@subwallet/extension-koni-ui/hooks/useGetSignMode';
import { useRejectExternalRequest } from '@subwallet/extension-koni-ui/hooks/useRejectExternalRequest';
import useTranslation from '@subwallet/extension-koni-ui/hooks/useTranslation';
import { makeCrossChainTransfer, makeCrossChainTransferLedger, makeCrossChainTransferQr } from '@subwallet/extension-koni-ui/messaging';
import Dropdown from '@subwallet/extension-koni-ui/Popup/XcmTransfer/XcmDropdown/Dropdown';
import { ThemeProps, TransferResultType } from '@subwallet/extension-koni-ui/types';
import React, { useCallback, useContext, useState } from 'react';
import styled from 'styled-components';

import FeeValue from '../../components/Balance/FeeValue';

interface Props extends ThemeProps {
  className?: string;
  onCancel: () => void;
  requestPayload: RequestCheckCrossChainTransfer;
  feeString: string;
  balanceFormat: BalanceFormatType; // decimal, symbol
  networkMap: Record<string, NetworkJson>;
  onChangeResult: (txResult: TransferResultType) => void;
  originChainOptions: DropdownTransformOptionType[];
  destinationChainOptions: DropdownTransformOptionType[];
}

function AuthTransaction ({ balanceFormat,
  className,
  destinationChainOptions,
  feeString,
  networkMap,
  onCancel,
  onChangeResult,
  originChainOptions,
  requestPayload }: Props): React.ReactElement<Props> | null {
  const { t } = useTranslation();

  const { cleanQrState, updateQrState } = useContext(QrSignerContext);

  const { clearExternalState, externalState, updateExternalState } = useContext(ExternalRequestContext);

  const { handlerReject } = useRejectExternalRequest();

  const { externalId } = externalState;

  const originNetworkPrefix = networkMap[requestPayload.originNetworkKey].ss58Format;
  const destinationNetworkPrefix = networkMap[requestPayload.destinationNetworkKey].ss58Format;
  const genesisHash = networkMap[requestPayload.originNetworkKey].genesisHash;

  const [isBusy, setBusy] = useState(false);
  const [password, setPassword] = useState<string>('');
  const [isKeyringErr, setKeyringErr] = useState<boolean>(false);
  const [errorArr, setErrorArr] = useState<string[]>([]);

  const account = useGetAccountByAddress(requestPayload.from);
  const signMode = useGetSignMode(account);

  const _onCancel = useCallback(async () => {
    await handlerReject(externalId);

    onCancel();
  }, [handlerReject, onCancel, externalId]);

  const handlerResponseError = useCallback((errors: BasicTxError[]) => {
    const errorMessage = errors.map((err) => err.message);

    if (errors.find((err) => err.code === 'keyringError')) {
      setKeyringErr(true);
    }

    setErrorArr(errorMessage);

    if (errorMessage && errorMessage.length) {
      setBusy(false);
    }
  }, []);

  const handlerCallbackResponseResult = useCallback((rs: BasicTxResponse) => {
    if (!rs.isFinalized) {
      if (rs.step === TransferStep.SUCCESS.valueOf()) {
        onChangeResult({
          isShowTxResult: true,
          isTxSuccess: rs.step === TransferStep.SUCCESS.valueOf(),
          extrinsicHash: rs.extrinsicHash
        });
        clearExternalState();
        cleanQrState();
        setBusy(false);
      } else if (rs.step === TransferStep.ERROR.valueOf()) {
        onChangeResult({
          isShowTxResult: true,
          isTxSuccess: rs.step === TransferStep.SUCCESS.valueOf(),
          extrinsicHash: rs.extrinsicHash,
          txError: rs.errors
        });
        clearExternalState();
        cleanQrState();
        setBusy(false);
      }
    }
  }, [clearExternalState, cleanQrState, onChangeResult]);

  const _doStart = useCallback((): void => {
    setBusy(true);
    makeCrossChainTransfer({
      ...requestPayload,
      password
    }, handlerCallbackResponseResult).then(handlerResponseError)
      .catch((e) => console.log('There is problem when makeTransfer', e));
  }, [requestPayload, password, handlerCallbackResponseResult, handlerResponseError]);

  const _doStartQr = useCallback(() => {
    setBusy(true);
    makeCrossChainTransferQr({
      ...requestPayload
    }, (rs) => {
      if (rs.externalState) {
        updateExternalState(rs.externalState);
      }

      if (rs.qrState) {
        const state: QrContextState = {
          ...rs.qrState,
          step: QrStep.DISPLAY_PAYLOAD
        };

        updateQrState(state);
        setBusy(false);
      }

      if (rs.isBusy && rs.step !== TransferStep.SUCCESS.valueOf()) {
        updateQrState({ step: QrStep.SENDING_TX });
        setBusy(true);
      }

      handlerCallbackResponseResult(rs);
    }).then(handlerResponseError)
      .catch((e) => console.log('There is problem when makeTransferQr', e));
  }, [handlerCallbackResponseResult, handlerResponseError, requestPayload, updateExternalState, updateQrState]);

  const _doStartLedger = useCallback((handlerSignLedger: (ledgerState: LedgerState) => void): void => {
    setBusy(true);
    makeCrossChainTransferLedger({
      ...requestPayload
    }, (rs) => {
      if (rs.externalState) {
        updateExternalState(rs.externalState);
      }

      if (rs.ledgerState) {
        handlerSignLedger(rs.ledgerState);
      }

      handlerCallbackResponseResult(rs);
    }).then(handlerResponseError)
      .catch((e) => console.log('There is problem when makeCrossChainTransferLedger', e));
  }, [updateExternalState, requestPayload, handlerCallbackResponseResult, handlerResponseError]);

  const _onChangePass = useCallback(
    (value: string): void => {
      setPassword(value);
      setErrorArr([]);
      setKeyringErr(false);
    },
    []
  );

  const handlerErrorQr = useCallback((error: Error) => {
    setErrorArr([error.message]);
  }, []);

  const handlerClearError = useCallback(() => {
    setErrorArr([]);
  }, []);

  const renderError = useCallback(() => {
    if (!!errorArr && errorArr.length) {
      return errorArr.map((err) =>
        (
          <Warning
            className='auth-transaction-error'
            isDanger
            key={err}
          >
            {t<string>(err)}
          </Warning>
        )
      );
    } else {
      return <></>;
    }
  }, [errorArr, t]);

  const handlerRenderInfo = useCallback(() => {
    return (
      <>
        <div className='bridge__chain-selector-area'>
          <Dropdown
            className='bridge__chain-selector'
            isDisabled={true}
            label={'Original Chain'}
            options={originChainOptions}
            value={requestPayload.originNetworkKey}
          />

          <div className='bridge__chain-swap'>
            <img
              alt='Icon'
              src={arrowRight}
            />
          </div>

          <Dropdown
            className='bridge__chain-selector'
            isDisabled={true}
            label={'Destination Chain'}
            options={destinationChainOptions}
            value={requestPayload.destinationNetworkKey}
          />
        </div>

        <InputAddress
          className={'auth-transaction__input-address'}
          defaultValue={requestPayload.from}
          help={t<string>('The account you will transfer from.')}
          isDisabled={true}
          isSetDefaultValue={true}
          label={t<string>('Origin Account')}
          networkPrefix={originNetworkPrefix}
          type='account'
          withEllipsis
        />

        <InputAddress
          className={'auth-transaction__input-address auth-transaction__destination-account'}
          defaultValue={requestPayload.to}
          help={t<string>('The account you want to transfer to.')}
          isDisabled={true}
          isSetDefaultValue={true}
          label={t<string>('Destination Account')}
          networkPrefix={destinationNetworkPrefix}
          type='allPlus'
          withEllipsis
        />

        <div className='auth-transaction__separator' />

        <div className='auth-transaction__info'>
          <div className='auth-transaction__info-text'>Amount</div>
          <div className='auth-transaction__info-value'>
            <FormatBalance
              format={balanceFormat}
              value={requestPayload.value}
            />
          </div>
        </div>

        <div className='auth-transaction__info'>
          <div className='auth-transaction__info-text'>Origin Chain Fee</div>
          <div className='auth-transaction__info-value'>
            <FeeValue feeString={feeString} />
          </div>
        </div>

        <div className='auth-transaction__info'>
          <div className='auth-transaction__info-text'>Total</div>
          <div className='auth-transaction__info-value'>
            <FormatBalance
              format={balanceFormat}
              value={requestPayload.value}
            />
            <span> + </span>
            <FeeValue feeString={feeString} />
          </div>
        </div>
      </>
    );
  }, [balanceFormat, destinationChainOptions, destinationNetworkPrefix, feeString, originChainOptions, originNetworkPrefix, requestPayload.destinationNetworkKey, requestPayload.from, requestPayload.originNetworkKey, requestPayload.to, requestPayload.value, t]);

  const handlerRenderContent = useCallback(() => {
    switch (signMode) {
      case SIGN_MODE.QR:
        return (
          <QrRequest
            clearError={handlerClearError}
            errorArr={errorArr}
            genesisHash={genesisHash}
            handlerStart={_doStartQr}
            isBusy={isBusy}
            onError={handlerErrorQr}
          >
            { handlerRenderInfo() }
          </QrRequest>
        );
      case SIGN_MODE.LEDGER:
        return (
          <LedgerRequest
            accountMeta={account}
            errorArr={errorArr}
            genesisHash={genesisHash}
            handlerSignLedger={_doStartLedger}
            isBusy={isBusy}
            setBusy={setBusy}
            setErrorArr={setErrorArr}
          >
            { handlerRenderInfo() }
          </LedgerRequest>
        );
      case SIGN_MODE.PASSWORD:
      default:
        return (
          <div className='auth-transaction-body'>
            { handlerRenderInfo() }
            <div className='auth-transaction__separator' />

            <InputWithLabel
              className='auth-transaction__password-area'
              isError={isKeyringErr}
              label={t<string>('Unlock account with password')}
              onChange={_onChangePass}
              type='password'
              value={password}
            />

            {renderError()}

            <div className='bridge-button-container'>
              <Button
                className='bridge-button'
                isDisabled={isBusy}
                onClick={_onCancel}
              >
                <span>
                  {t<string>('Reject')}
                </span>
              </Button>

              <Button
                className='bridge-button'
                isBusy={isBusy}
                isDisabled={!password}
                onClick={_doStart}
              >
                <span>
                  {t<string>('Confirm')}
                </span>
              </Button>
            </div>
          </div>
        );
    }
  }, [_doStart, _doStartLedger, _doStartQr, _onCancel, _onChangePass, account, errorArr, genesisHash, handlerClearError, handlerErrorQr, handlerRenderInfo, isBusy, isKeyringErr, password, renderError, signMode, t]);

  return (
    <div className={className}>
      <Modal className={'signer-modal'}>
        <div className='auth-transaction-header'>
          <div className='auth-transaction-header__part-1' />
          <div className='auth-transaction-header__part-2'>
            {t<string>('Authorize Transaction')}
          </div>
          <div className='auth-transaction-header__part-3'>
            {isBusy
              ? (
                <span className={'auth-transaction-header__close-btn -disabled'}>{t('Cancel')}</span>
              )
              : (
                <span
                  className={'auth-transaction-header__close-btn'}
                  // eslint-disable-next-line @typescript-eslint/no-misused-promises
                  onClick={_onCancel}
                >{t('Cancel')}</span>
              )
            }
          </div>
        </div>

        { handlerRenderContent() }

      </Modal>
    </div>
  );
}

export default React.memo(styled(AuthTransaction)(({ theme }: ThemeProps) => `
  .subwallet-modal {
    max-width: 460px;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    border-radius: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .signer-modal {
    .subwallet-modal {
        border: 1px solid ${theme.extensionBorder};
    }
  }

  .auth-transaction-error {
    margin-top: 10px
  }

  .display-qr {
    margin: 0 30px;
    display: flex;
    justify-content: center;
    align-items: center;

    .qr-content {
      height: 324px;
      width: 324px;
      border: 2px solid ${theme.textColor};
    }
  }

  .scan-qr {
    margin: 0 20px;
  }

  .auth-transaction-header {
    display: flex;
    align-items: center;
    height: 72px;
    box-shadow: ${theme.headerBoxShadow};
  }

  .auth-transaction-body {
    flex: 1;
    padding-left: 22px;
    padding-right: 22px;
    padding-bottom: 15px;
    padding-top: 25px;
    overflow-y: auto;
  }

  .auth-transaction__password-area {
    margin-top: 8px;
    margin-bottom: 2px;

    .label-wrapper {
      margin-bottom: 6px;
    }
  }

  .auth-transaction__separator + .auth-transaction__info {
    margin-top: 10px;
  }

  .auth-transaction-header__part-1 {
    flex: 1;
  }

  .auth-transaction-header__part-2 {
    color: ${theme.textColor};
    font-size: 20px;
    font-weight: 500;
  }

  .auth-transaction-header__part-3 {
    flex: 1;
    display: flex;
    justify-content: flex-end;
  }

  .auth-transaction-header__close-btn {
    padding-left: 16px;
    padding-right: 16px;
    height: 40px;
    display: flex;
    align-items: center;
    color: ${theme.buttonTextColor2};
    cursor: pointer;
  }

  .auth-transaction-header__close-btn.-disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .auth-transaction__submit-wrapper {
    position: sticky;
    bottom: -15px;
    padding: 15px;
    margin-left: -15px;
    margin-bottom: -15px;
    margin-right: -15px;
    background-color: ${theme.background};
  }

  .auth-transaction__input-address {
    .input-address__dropdown {
      border: 0;
      height: auto;
    }

    .key-pair__icon {
      display: none;
    }

    > label {
      left: 0;
    }

    .key-pair__name {
      padding-left: 0;
      font-size: 15px;
    }

    .input-address-dropdown__value-container {
      padding-left: 0;
      padding-right: 0;
    }

    .input-address-dropdown__single-value {
      margin-left: 0;
      margin-right: 0;
    }
  }

  .auth-transaction__destination-account {
    margin-top: -5px;
  }

  .auth-transaction__info {
    display: flex;
    width: 100%;
    padding: 2px 0;
    flex-wrap: wrap;
  }

  .auth-transaction__info-text, auth-transaction__info-value {
    font-size: 15px;
    line-height: 26px;
    font-weight: 500;
  }

  .auth-transaction__info-text {
    color: ${theme.textColor2};
  }

  .auth-transaction__info-value {
    color: ${theme.textColor};
    flex: 2;
    text-align: right;
    font-weight: 500;
  }

  .auth-transaction__info-value .format-balance__front-part {
    overflow: hidden;
    white-space: nowrap;
    max-width: 160px;
    text-overflow: ellipsis;
    display: inline-block;
    vertical-align: top;
  }

  .auth-transaction__separator {
    padding-top: 10px;
    border-bottom: 1px solid ${theme.menuItemsBorder};
  }

  .auth-transaction__info-value .value-separator {
    margin: 0 4px;
  }

  .auth-transaction__info-value .format-balance {
    display: inline-block;
  }

  .bridge__chain-selector-area.bridge__chain-selector-area {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    margin-bottom: 9px;
  }

  .bridge__chain-selector {
    flex: 1;
  }

  .bridge__chain-selector label {
    font-size: 15px;
    text-transform: none;
    color: ${theme.textColor};
    line-height: 26px;
    font-weight: 500;
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
    margin: 24px 12px 0;
  }
`));
