// Copyright 2019-2022 @polkadot/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { useCallback, useContext, useEffect, useState } from 'react';
import styled from 'styled-components';

import HeaderWithSteps from '@polkadot/extension-koni-ui/partials/HeaderWithSteps';
import { EVM_ACCOUNT_TYPE, SUBSTRATE_ACCOUNT_TYPE } from '@polkadot/extension-koni-ui/Popup/CreateAccount';
import { ThemeProps } from '@polkadot/extension-koni-ui/types';
import { KeypairType } from '@polkadot/util-crypto/types';

import { AccountContext, ActionContext } from '../../components';
import AccountNamePasswordCreation from '../../components/AccountNamePasswordCreation';
import useMetadata from '../../hooks/useMetadata';
import useTranslation from '../../hooks/useTranslation';
import { createAccountSuriV2 } from '../../messaging';
import { DEFAULT_TYPE } from '../../util/defaultType';
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
  const [isBusy, setIsBusy] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  // @ts-ignore
  const [keyTypes, setKeyTypes] = useState<Array<KeypairType>>([SUBSTRATE_ACCOUNT_TYPE, EVM_ACCOUNT_TYPE]);
  const accountsWithoutAll = accounts.filter((acc: { address: string; }) => acc.address !== 'ALL');
  const name = `Account ${accountsWithoutAll.length + 1}`;
  const [step1, setStep1] = useState(true);
  // @ts-ignore
  const [type, setType] = useState(DEFAULT_TYPE);
  // @ts-ignore
  const chain = useMetadata(account && account.genesis, true);

  useEffect((): void => {
    !accounts.length && onAction();
  }, [accounts, onAction]);

  const _onCreate = useCallback((name: string, password: string): void => {
    // this should always be the case
    if (name && password && account) {
      setIsBusy(true);

      createAccountSuriV2(name, password, account.suri, keyTypes)
        .then(() => {
          window.localStorage.setItem('popupNavigation', '/');
          onAction('/');
        })
        .catch((error): void => {
          setIsBusy(false);
          console.error(error);
        });
    }
  }, [account, onAction, keyTypes]);

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
            name={name}
            onAccountChange={setAccount}
            onNextStep={_onNextStep}
            type={type}
          />
        )
        : (
          <AccountNamePasswordCreation
            address={account?.address}
            buttonLabel={t<string>('Add the account with the supplied seed')}
            className='koni-import-seed-content'
            genesis={account?.genesis}
            isBusy={isBusy}
            name={name}
            onCreate={_onCreate}
          />
        )
      }
    </>
  );
}

export default styled(ImportSeed)`
`;
