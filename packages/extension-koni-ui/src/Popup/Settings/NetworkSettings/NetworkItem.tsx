// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { faTrashAlt } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { _DEFAULT_CHAINS } from '@subwallet/chain';
import { _ChainInfo } from '@subwallet/chain/types';
import { _ChainState } from '@subwallet/extension-koni-base/services/chain-service/types';
import { _isCustomNetwork } from '@subwallet/extension-koni-base/services/chain-service/utils';
import { AccountContext, ActionContext, Button, ButtonArea, HorizontalLabelToggle } from '@subwallet/extension-koni-ui/components';
import Modal from '@subwallet/extension-koni-ui/components/Modal';
import useToast from '@subwallet/extension-koni-ui/hooks/useToast';
import useTranslation from '@subwallet/extension-koni-ui/hooks/useTranslation';
import { disableChain, enableChain, removeChain } from '@subwallet/extension-koni-ui/messaging';
import { store } from '@subwallet/extension-koni-ui/stores';
import { NetworkConfigParams } from '@subwallet/extension-koni-ui/stores/types';
import { ThemeProps } from '@subwallet/extension-koni-ui/types';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import styled from 'styled-components';

interface Props extends ThemeProps {
  className?: string;
  chainInfo: _ChainInfo;
  chainState: _ChainState;
}

function NetworkItem ({ chainInfo, chainState, className }: Props): React.ReactElement {
  const { show } = useToast();
  const { accounts } = useContext(AccountContext);
  const navigate = useContext(ActionContext);
  const [showModal, setShowModal] = useState(false);
  const [isHover, setIsHover] = useState(false);
  const { t } = useTranslation();

  const originGenesisHashes = useMemo((): string[] => {
    const result: Record<string, string> = {};

    accounts.forEach((acc) => {
      if (acc.originGenesisHash) {
        result[acc.originGenesisHash] = acc.originGenesisHash;
      }
    });

    return Object.keys(result);
  }, [accounts]);

  const handleHideModal = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleShowModal = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    setShowModal(true);
  }, []);

  const handleShowStateConfirm = useCallback((resp: boolean) => {
    if (resp) {
      show(`${chainInfo.name} has ${chainState.active ? 'disconnected' : 'connected'} successfully`);
    } else {
      show(`${chainInfo.name} has failed to ${chainState.active ? 'disconnect' : 'connect'}`);
    }
  }, [chainInfo.name, chainState.active, show]);

  const handleShowDeleteConfirm = useCallback((resp: boolean) => {
    if (resp) {
      show('Removed 1 network successfully');
    } else {
      show('Cannot remove an active network');
    }
  }, [show]);

  const toggleActive = useCallback((val: boolean) => {
    if (_DEFAULT_CHAINS.includes(chainInfo.slug)) {
      show('This network is active by default');

      return;
    }

    if (chainInfo.substrateInfo && originGenesisHashes.includes(chainInfo.substrateInfo?.genesisHash)) {
      show('You have a ledger account connected to this network');

      return;
    }

    if (!val) {
      disableChain(chainInfo.slug)
        .then(({ success }) => handleShowStateConfirm(success))
        .catch(console.error);
    } else {
      enableChain(chainInfo.slug)
        .then((resp) => handleShowStateConfirm(resp))
        .catch(console.error);
    }
  }, [chainInfo.slug, chainInfo.substrateInfo, originGenesisHashes, show, handleShowStateConfirm]);

  const handleNetworkEdit = useCallback(() => {
    store.dispatch({ type: 'networkConfigParams/update', payload: { data: chainInfo, mode: 'edit' } as NetworkConfigParams });
    navigate('/account/config-network');
  }, [chainInfo, navigate]);

  const handleDeleteNetwork = useCallback(() => {
    removeChain(chainInfo.slug)
      .then((result) => handleShowDeleteConfirm(result))
      .catch(console.error);
    handleHideModal();
  }, [handleHideModal, handleShowDeleteConfirm, chainInfo.slug]);

  const handleMouseEnterChain = useCallback(() => {
    setIsHover(true);
  }, []);

  const handleMouseLeaveChain = useCallback(() => {
    setIsHover(false);
  }, []);

  return (
    <div
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      className={`network-item ${className}`}
    >
      <div className='network-item__top-content'>
        <HorizontalLabelToggle
          checkedLabel={''}
          className='info'
          toggleFunc={toggleActive}
          uncheckedLabel={''}
          value={chainState.active}
        />
        <div
          className={'link-edit'}
          onClick={handleNetworkEdit}
          onMouseEnter={handleMouseEnterChain}
          onMouseLeave={handleMouseLeaveChain}
        >
          <div
            className={`${isHover ? 'hover-toggle' : 'unhover-toggle'} network-item__text`}
          >
            {chainInfo.name}
          </div>
          {
            _isCustomNetwork(chainInfo.slug)
              ? <div className={'network-icon-container'}>
                <FontAwesomeIcon
                  className='network-delete-icon'
                  // @ts-ignore
                  icon={faTrashAlt}
                  // @ts-ignore
                  onClick={handleShowModal}
                  size='sm'
                />

                <div
                  onClick={handleNetworkEdit}
                >
                  <div className={`${isHover ? 'hover-toggle' : 'unhover-toggle'} network-item__toggle`} />
                </div>
              </div>
              : <div className={'default-network-icon-container'}>
                <div
                  onClick={handleNetworkEdit}
                >
                  <div className={`${isHover ? 'hover-toggle' : 'unhover-toggle'} network-item__toggle`} />
                </div>
              </div>
          }
        </div>
      </div>
      <div className='network-item__separator' />

      {
        showModal &&
        <Modal
          className={'confirm-delete-modal'}
        >
          <div>
            <div className={'delete-modal-title'}>
              <div className={'delete-title'}>Remove this network ?</div>
              <div
                className={'close-btn'}
                onClick={handleHideModal}
              >
                x
              </div>
            </div>

            <ButtonArea
              className={'delete-button-area'}
            >
              <Button
                className='network-edit-button'
                onClick={handleHideModal}
              >
                <span>{t<string>('Cancel')}</span>
              </Button>
              <Button
                className='network-edit-button'
                onClick={handleDeleteNetwork}
              >
                {t<string>('Confirm')}
              </Button>
            </ButtonArea>
          </div>
        </Modal>
      }
    </div>
  );
}

export default styled(NetworkItem)(({ theme }: Props) => `
  .default-network-icon-container {
    width: 10%;
    display: flex;
    justify-content: end;
    align-items: center;
  }

  .close-btn {
    font-size: 20px;
    cursor: pointer;
  }

  .hover-toggle {
    color: ${theme.textColor};
  }

  .unhover-toggle {
    color: ${theme.textColor2};
  }

  .delete-modal-title {
    display: flex;
    justify-content: space-between;
  }

  .delete-button-area {
    margin-top: 20px;
  }

  .network-edit-button:first-child {
    margin-right: 8px;
    background-color: ${theme.buttonBackground1};
    font-size: 15px;

    span {
      color: ${theme.buttonTextColor2};
    }
  }

  .network-edit-button:nth-child(2) {
    background-color: ${theme.buttonBackgroundDanger};
    font-size: 15px;

    span {
      color: ${theme.buttonTextColor};
    }
  }

  .delete-title {
    font-size: 20px;
    font-weight: 500;
  }

  .confirm-delete-modal .subwallet-modal {
    width: 320px;
    padding: 20px;
    top: 30%;
  }

  .link-edit {
    display: flex;
    align-items: center;
    cursor: pointer;
    width: 100%;
    gap: 10px;
    padding-top: 12px;
    padding-bottom: 12px;
  }

  .network-icon-container {
    width: 10%;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .network-item__text {
    width: 80%;
    font-size: 15px;
    line-height: 26px;
    font-weight: 500;
  }

  .network-delete-icon {
    color: ${theme.textColor2};
  }

  .network-delete-icon:hover {
    color: ${theme.iconDangerColor};
  }

  .network-item__toggle {
    border-style: solid;
    border-width: 0 2px 2px 0;
    display: inline-block;
    padding: 3.5px;
    transform: rotate(-45deg);
  }
`);
