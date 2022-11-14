// Copyright 2019-2022 @polkadot/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Button, Spinner } from '@subwallet/extension-koni-ui/components';
import { ScannerContext, ScannerContextType } from '@subwallet/extension-koni-ui/contexts/ScannerContext';
import { useGetNetworkQrRequest } from '@subwallet/extension-koni-ui/hooks/useGetNetworkQrRequest';
import useTranslation from '@subwallet/extension-koni-ui/hooks/useTranslation';
import NetworkInfo from '@subwallet/extension-koni-ui/Popup/ExternalRequest/Shared/NetworkInfo';
import MessageSigned from '@subwallet/extension-koni-ui/Popup/ExternalRequest/ViewQRDetail/MessageSigned';
import TransactionSigned from '@subwallet/extension-koni-ui/Popup/ExternalRequest/ViewQRDetail/TransactionSigned';
import { ThemeProps } from '@subwallet/extension-koni-ui/types';
import CN from 'classnames';
import React, { useCallback, useContext } from 'react';
import styled from 'styled-components';

interface Props extends ThemeProps {
  className?: string;
  onClose: () => void;
}

const ViewQRDetail = (props: Props) => {
  const { className, onClose } = props;

  const { t } = useTranslation();

  const scannerStore = useContext<ScannerContextType>(ScannerContext);
  const { state } = scannerStore;
  const { evmChainId, isEthereumStructure, type } = state;

  const { loading, network } = useGetNetworkQrRequest();

  const handlerRenderContent = useCallback(() => {
    if (loading || !network) {
      return (<></>);
    }

    if (network) {
      if (type === 'message') {
        return (
          <MessageSigned />
        );
      } else if (type === 'transaction') {
        return (
          <TransactionSigned network={network} />
        );
      }

      return <></>;
    } else {
      return <></>;
    }
  }, [loading, network, type]);

  const handlerClickClose = useCallback(() => {
    onClose && onClose();
  }, [onClose]);

  if (loading && !network) {
    return (
      <div>
        <Spinner />
      </div>
    );
  }

  return (
    <div className={CN(className)}>
      <div className='info-area'>
        {
          (loading || !network) && (
            <div className={CN('loading')}>
              <Spinner />
            </div>
          )
        }
        {
          (!loading && network) && (
            <div className='network-info-container'>
              <NetworkInfo
                forceEthereum={isEthereumStructure && !evmChainId}
                network={network}
              />
            </div>
          )
        }
        {handlerRenderContent()}
      </div>
      <div className='action-area'>
        <div className={CN('action-container')}>
          <Button
            className={CN('button')}
            onClick={handlerClickClose}
          >
            {t('Close')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(styled(ViewQRDetail)(({ theme }: Props) => `
  padding: 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100%;

  .loading{
    position: relative;
    height: 395px;
  }

  .info-area {
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .network-info-container {
    margin-bottom: 10px;
  }

  .action-container {
    position: sticky;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;

    .button{
      margin-top: 8px;
      width: 170px;
    }
  }

`));
