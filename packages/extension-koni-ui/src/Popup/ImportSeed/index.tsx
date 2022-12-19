// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import HeaderWithSteps from '@subwallet/extension-koni-ui/partials/HeaderWithSteps';
import { EVM_ACCOUNT_TYPE, SUBSTRATE_ACCOUNT_TYPE } from '@subwallet/extension-koni-ui/Popup/CreateAccount';
import { RootState } from '@subwallet/extension-koni-ui/stores';
import { ThemeProps } from '@subwallet/extension-koni-ui/types';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { KeypairType } from '@polkadot/util-crypto/types';

import { AccountContext, ActionContext } from '../../components';
import AccountNamePasswordCreation from '../../components/AccountNamePasswordCreation';
import useTranslation from '../../hooks/useTranslation';
import { createAccountSuriV2 } from '../../messaging';
import SeedAndPath from './SeedAndPath';

export interface AccountInfo {
  address: string;
  genesis?: string;
  suri: string;
}

interface Props extends ThemeProps {
  className?: string;
}

function ImportSeed ({ className = '' }: Props): React.ReactElement {
  const { t } = useTranslation();
  const { accounts } = useContext(AccountContext);
  const onAction = useContext(ActionContext);
  const { genesisHash } = useSelector((state: RootState) => state.currentNetwork);
  const [isBusy, setIsBusy] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [evmAccount, setEvmAccount] = useState<AccountInfo | null>(null);
  const [selectedGenesis, setSelectedGenesis] = useState<string>('');
  const [isConnectWhenImport, setConnectWhenImport] = useState(true);
  const [keyTypes, setKeyTypes] = useState<Array<KeypairType>>([SUBSTRATE_ACCOUNT_TYPE, EVM_ACCOUNT_TYPE]);
  const dep = keyTypes.toString();
  const accountsWithoutAll = accounts.filter((acc: { address: string; }) => acc.address !== 'ALL');
  const [name, setName] = useState(`Account ${accountsWithoutAll.length + 1}`);
  const [step1, setStep1] = useState(true);

  useEffect(() => {
    setSelectedGenesis(genesisHash);
  }, [genesisHash]);

  useEffect((): void => {
    !accounts.length && onAction();
  }, [accounts, onAction]);

  const _onCreate = useCallback((name: string): void => {
    // this should always be the case
    if (name && account) {
      setIsBusy(true);

      createAccountSuriV2({
        name: name,
        suri: account.suri,
        isAllowed: isConnectWhenImport,
        types: keyTypes,
        genesisHash: selectedGenesis
      })
        .then(() => {
          window.localStorage.setItem('popupNavigation', '/');
          onAction('/');
        })
        .catch((error): void => {
          setIsBusy(false);
          console.error(error);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnectWhenImport, account, selectedGenesis, onAction, dep]);

  const _onNextStep = useCallback(
    () => setStep1(false),
    []
  );

  const _onBackClick = useCallback(
    () => setStep1(true),
    []
  );

  return (
    <>
      <HeaderWithSteps
        isBusy={isBusy}
        onBackClick={_onBackClick}
        step={step1 ? 1 : 2}
        text={t<string>('Import account')}
      />
      {step1
        ? (
          <SeedAndPath
            account={account}
            className='import-seed-content-wrapper'
            evmAccount={evmAccount}
            isConnectWhenImport={isConnectWhenImport}
            keyTypes={keyTypes}
            name={name}
            onAccountChange={setAccount}
            onConnectWhenImport={setConnectWhenImport}
            onEvmAccountChange={setEvmAccount}
            onNextStep={_onNextStep}
            onSelectAccountImported={setKeyTypes}
            setSelectedGenesis={setSelectedGenesis}
          />
        )
        : (
          <AccountNamePasswordCreation
            address={account?.address}
            buttonLabel={t<string>('Add the account with the supplied seed')}
            className='koni-import-seed-content'
            evmAddress={evmAccount?.address}
            isBusy={isBusy}
            keyTypes={keyTypes}
            name={name}
            onCreate={_onCreate}
            selectedGenesis={selectedGenesis}
            setName={setName}
          />
        )
      }
    </>
  );
}

export default styled(ImportSeed)`
`;
