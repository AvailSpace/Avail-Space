// Copyright 2019-2022 @subwallet/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import SelectAccountType from '@subwallet/extension-koni-ui/components/Account/SelectAccountType';
import BackIcon from '@subwallet/extension-koni-ui/components/Icon/BackIcon';
import CloseIcon from '@subwallet/extension-koni-ui/components/Icon/CloseIcon';
import { BaseModal } from '@subwallet/extension-koni-ui/components/Modal/BaseModal';
import { DEFAULT_ACCOUNT_TYPES } from '@subwallet/extension-koni-ui/constants/account';
import { CREATE_ACCOUNT_MODAL, NEW_ACCOUNT_MODAL, SEED_PHRASE_MODAL } from '@subwallet/extension-koni-ui/constants/modal';
import { ScreenContext } from '@subwallet/extension-koni-ui/contexts/ScreenContext';
import useTranslation from '@subwallet/extension-koni-ui/hooks/common/useTranslation';
import useClickOutSide from '@subwallet/extension-koni-ui/hooks/dom/useClickOutSide';
import useSwitchModal from '@subwallet/extension-koni-ui/hooks/modal/useSwitchModal';
import { ThemeProps } from '@subwallet/extension-koni-ui/types';
import { setSelectedAccountTypes } from '@subwallet/extension-koni-ui/utils';
import { renderModalSelector } from '@subwallet/extension-koni-ui/utils/common/dom';
import { Button, Icon, ModalContext } from '@subwallet/react-ui';
import CN from 'classnames';
import { CheckCircle } from 'phosphor-react';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import styled from 'styled-components';

import { KeypairType } from '@polkadot/util-crypto/types';

type Props = ThemeProps & {
  setAccountTypes?: React.Dispatch<React.SetStateAction<KeypairType[]>>
};

const modalId = NEW_ACCOUNT_MODAL;

const Component: React.FC<Props> = ({ className, setAccountTypes }: Props) => {
  const { t } = useTranslation();
  const { activeModal, checkActive, inactiveModal } = useContext(ModalContext);
  const isActive = checkActive(modalId);
  const { isWebUI } = useContext(ScreenContext);
  const [selectedItems, setSelectedItems] = useState<KeypairType[]>(DEFAULT_ACCOUNT_TYPES);

  const onCancel = useCallback(() => {
    inactiveModal(modalId);
  }, [inactiveModal]);

  const onSubmit = useCallback(() => {
    if (isWebUI) {
      activeModal(SEED_PHRASE_MODAL);

      setAccountTypes && setAccountTypes(selectedItems);
    } else {
      setSelectedAccountTypes(selectedItems);
    }

    inactiveModal(modalId);
  }, [isWebUI, inactiveModal, activeModal, setAccountTypes, selectedItems]);

  const onBack = useSwitchModal(modalId, CREATE_ACCOUNT_MODAL);

  useClickOutSide(isActive, renderModalSelector(className), onCancel);

  useEffect(() => {
    if (!isActive) {
      setSelectedItems(DEFAULT_ACCOUNT_TYPES);
    }
  }, [isActive]);

  return (
    <BaseModal
      className={CN(className)}
      closeIcon={(<BackIcon />)}
      id={modalId}
      maskClosable={false}
      onCancel={onBack}
      rightIconProps={{
        icon: <CloseIcon />,
        onClick: onCancel
      }}
      title={t<string>('Select account type')}
    >
      <div className='__select-account-type'>
        <SelectAccountType
          selectedItems={selectedItems}
          setSelectedItems={setSelectedItems}
        />
      </div>
      <Button
        block={true}
        disabled={!selectedItems.length}
        icon={(
          <Icon
            className={'icon-submit'}
            phosphorIcon={CheckCircle}
            weight='fill'
          />
        )}
        onClick={onSubmit}
      >
        {t('Confirm')}
      </Button>
    </BaseModal>
  );
};

const CreateAccountModal = styled(Component)<Props>(({ theme: { token } }: Props) => {
  return {
    '.__select-account-type': {
      marginBottom: token.size
    }
  };
});

export default CreateAccountModal;
