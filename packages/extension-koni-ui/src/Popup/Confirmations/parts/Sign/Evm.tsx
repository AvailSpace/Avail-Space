// Copyright 2019-2022 @subwallet/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ConfirmationDefinitions, ConfirmationResult, EvmSendTransactionRequest } from '@subwallet/extension-base/background/KoniTypes';
import { CONFIRMATION_QR_MODAL } from '@subwallet/extension-koni-ui/constants/modal';
import { useGetChainInfoByChainId, useLedger, useNotification } from '@subwallet/extension-koni-ui/hooks';
import { completeConfirmation } from '@subwallet/extension-koni-ui/messaging';
import { PhosphorIcon, SigData, ThemeProps } from '@subwallet/extension-koni-ui/types';
import { AccountSignMode } from '@subwallet/extension-koni-ui/types/account';
import { EvmSignatureSupportType } from '@subwallet/extension-koni-ui/types/confirmation';
import { isEvmMessage } from '@subwallet/extension-koni-ui/utils';
import { getSignMode } from '@subwallet/extension-koni-ui/utils/account/account';
import { Button, Icon, ModalContext } from '@subwallet/react-ui';
import CN from 'classnames';
import { CheckCircle, QrCode, Swatches, XCircle } from 'phosphor-react';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import { hexToU8a } from '@polkadot/util';

import { DisplayPayloadModal, EvmQr, ScanSignature } from '../Qr';

interface Props extends ThemeProps {
  id: string;
  type: EvmSignatureSupportType;
  payload: ConfirmationDefinitions[EvmSignatureSupportType][0];
}

const handleConfirm = async (type: EvmSignatureSupportType, id: string, payload: string) => {
  return await completeConfirmation(type, {
    id,
    isApproved: true,
    payload
  } as ConfirmationResult<string>);
};

const handleCancel = async (type: EvmSignatureSupportType, id: string) => {
  return await completeConfirmation(type, {
    id,
    isApproved: false
  } as ConfirmationResult<string>);
};

const handleSignature = async (type: EvmSignatureSupportType, id: string, signature: string) => {
  return await completeConfirmation(type, {
    id,
    isApproved: true,
    payload: signature
  } as ConfirmationResult<string>);
};

const Component: React.FC<Props> = (props: Props) => {
  const { className, id, payload, type } = props;
  const { payload: { account, canSign, hashPayload } } = payload;
  const chainId = (payload.payload as EvmSendTransactionRequest)?.chainId || 1;

  const { t } = useTranslation();
  const notify = useNotification();

  const { activeModal } = useContext(ModalContext);

  const chain = useGetChainInfoByChainId(chainId);

  const signMode = useMemo(() => getSignMode(account), [account]);
  const isLedger = useMemo(() => signMode === AccountSignMode.LEDGER, [signMode]);
  const isMessage = isEvmMessage(payload);

  const [loading, setLoading] = useState(false);

  const { error: ledgerError,
    isLoading: isLedgerLoading,
    isLocked,
    ledger,
    refresh: refreshLedger,
    signMessage: ledgerSignMessage,
    signTransaction: ledgerSignTransaction,
    warning: ledgerWarning } = useLedger(chain?.slug, isLedger);

  const isLedgerConnected = useMemo(() => !isLocked && !isLedgerLoading && !!ledger, [
    isLedgerLoading,
    isLocked,
    ledger
  ]);

  const approveIcon = useMemo((): PhosphorIcon => {
    switch (signMode) {
      case AccountSignMode.QR:
        return QrCode;
      case AccountSignMode.LEDGER:
        return Swatches;
      default:
        return CheckCircle;
    }
  }, [signMode]);

  // Handle buttons actions
  const onCancel = useCallback(() => {
    setLoading(true);
    handleCancel(type, id).finally(() => {
      setLoading(false);
    });
  }, [id, type]);

  const onApprovePassword = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      handleConfirm(type, id, '').finally(() => {
        setLoading(false);
      });
    }, 1000);
  }, [id, type]);

  const onApproveSignature = useCallback((signature: SigData) => {
    setLoading(true);

    setTimeout(() => {
      handleSignature(type, id, signature.signature)
        .catch((e) => {
          console.log(e);
        })
        .finally(() => {
          setLoading(false);
        });
    }, 300);
  }, [id, type]);

  const onConfirmQr = useCallback(() => {
    activeModal(CONFIRMATION_QR_MODAL);
  }, [activeModal]);

  const onConfirmLedger = useCallback(() => {
    if (!hashPayload) {
      return;
    }

    if (!isLedgerConnected || !ledger) {
      refreshLedger();

      return;
    }

    setLoading(true);

    setTimeout(() => {
      const signPromise = isMessage ? ledgerSignMessage(hexToU8a(hashPayload), account.accountIndex, account.addressOffset) : ledgerSignTransaction(hexToU8a(hashPayload), account.accountIndex, account.addressOffset);

      signPromise
        .then(({ signature }) => {
          onApproveSignature({ signature });
        })
        .catch((e: Error) => {
          console.log(e);
          setLoading(false);
        });
    });
  }, [account.accountIndex, account.addressOffset, hashPayload, isLedgerConnected, isMessage, ledger, ledgerSignMessage, ledgerSignTransaction, onApproveSignature, refreshLedger]);

  const onConfirm = useCallback(() => {
    switch (signMode) {
      case AccountSignMode.QR:
        onConfirmQr();
        break;
      case AccountSignMode.LEDGER:
        onConfirmLedger();
        break;
      default:
        onApprovePassword();
    }
  }, [onApprovePassword, onConfirmLedger, onConfirmQr, signMode]);

  useEffect(() => {
    !!ledgerError && notify({
      message: ledgerError,
      type: 'error'
    });
  }, [ledgerError, notify]);

  useEffect(() => {
    !!ledgerWarning && notify({
      message: ledgerWarning,
      type: 'warning'
    });
  }, [ledgerWarning, notify]);

  return (
    <div className={CN(className, 'confirmation-footer')}>
      <Button
        disabled={loading}
        icon={(
          <Icon
            phosphorIcon={XCircle}
            weight='fill'
          />
        )}
        onClick={onCancel}
        schema={'secondary'}
      >
        {t('Cancel')}
      </Button>
      <Button
        disabled={!canSign}
        icon={(
          <Icon
            phosphorIcon={approveIcon}
            weight='fill'
          />
        )}
        loading={loading}
        onClick={onConfirm}
      >
        {t('Approve')}
      </Button>
      {
        signMode === AccountSignMode.QR && (
          <DisplayPayloadModal>
            <EvmQr
              address={account.address}
              hashPayload={hashPayload}
              isMessage={isEvmMessage(payload)}
            />
          </DisplayPayloadModal>
        )
      }
      {signMode === AccountSignMode.QR && <ScanSignature onSignature={onApproveSignature} />}
    </div>
  );
};

const EvmSignArea = styled(Component)<Props>(({ theme: { token } }: Props) => {
  return {};
});

export default EvmSignArea;
