// Copyright 2019-2022 @polkadot/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { ThemeProps } from '../../types';

import CN from 'classnames';
import React, { useCallback } from 'react';
import styled from 'styled-components';

import Button from '@polkadot/extension-koni-ui/components/Button';
import useIsPopup from '@polkadot/extension-koni-ui/hooks/useIsPopup';
import { windowOpen } from '@polkadot/extension-koni-ui/messaging';
import Header from '@polkadot/extension-koni-ui/partials/Header';

import { Link } from '../../components';
import useTranslation from '../../hooks/useTranslation';

interface Props extends ThemeProps {
  className?: string;
}

const jsonPath = '/account/restore-json';
const createAccountPath = '/account/create';

function AddAccount ({ className }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const isPopup = useIsPopup();
  const isFirefox = window.localStorage.getItem('browserInfo') === 'Firefox';
  const isLinux = window.localStorage.getItem('osInfo') === 'Linux';

  const _openJson = useCallback(
    () => {
      window.localStorage.setItem('popupNavigation', jsonPath);
      windowOpen(jsonPath).catch((e) => console.log('error', e));
    }, []
  );

  const _openCreateAccount = useCallback(
    () => {
      window.localStorage.setItem('popupNavigation', createAccountPath);
      windowOpen(createAccountPath).catch((e) => console.log('error', e));
    }, []
  );

  return (
    <>
      <Header
        isNotHaveAccount
        showAdd
        showSettings
        showSubHeader
        subHeaderName={t<string>('Add Account')}
      />
      <div className={CN(className, { full: !isPopup })}>
        <div className='add-account-wrapper'>
          {/* { */}
          {/*  !isPopup && ( */}
          {/*    <div className={'subheader-container'}> */}
          {/*      <div className='subheader-container__text'> */}
          {/*        {t<string>('Add Account')} */}
          {/*      </div> */}
          {/*    </div> */}
          {/*  ) */}
          {/* } */}
          <div className='no-accounts'>
            <p>{t<string>("You currently don't have any accounts. Create your first account or import another account to get started.")}</p>
          </div>

          <Button
            className='add-account-btn create-account'
            data-export-button
          >
            <Link
              className='add-account-link__create-account'
              onClick={isPopup && (isFirefox || isLinux) ? _openCreateAccount : undefined}
              to={isPopup && (isFirefox || isLinux) ? undefined : createAccountPath}
            >
              {t<string>('Create new account')}
            </Link>
          </Button>

          <Button
            className='add-account-btn'
            data-export-button
          >
            <Link
              className='add-account-link'
              to={'/account/import-seed'}
            >
              {t<string>('Import account from pre-existing seed')}
            </Link>
          </Button>

          <Button
            className='add-account-btn'
            data-export-button
          >
            <Link
              className='add-account-link'
              onClick={isPopup && (isFirefox || isLinux) ? _openJson : undefined}
              to={isPopup && (isFirefox || isLinux) ? undefined : jsonPath}
            >
              {t<string>('Restore account from JSON backup file')}
            </Link>
          </Button>
        </div>
      </div>
    </>
  );
}

export default React.memo(styled(AddAccount)(({ theme }: Props) => `
  color: ${theme.textColor};
  height: 100%;


  &.full{
    padding: 25px 0;
    background-color: ${theme.layoutBackground};
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden auto;
    flex-wrap: wrap;

    .add-account-wrapper {
      padding: 20px 40px;
      border-radius: 5px;
      background-color: ${theme.background};
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .add-account-btn{
      width: 360px;
    }
  }


  .subheader-container__text {
    align-items: center;
    font-size: 20px;
    line-height: 30px;
    font-weight: 500;
    color: ${theme.textColor};
  }

  .subheader-container{
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .add-account-wrapper {
    padding: 0 40px;
  }

  .add-account-btn {
    margin-bottom: 15px;
  }

  .create-account {
    background-color: ${theme.buttonBackground2};
    color: ${theme.buttonTextColor3};
  }

  .add-account-link {
    justify-content: center;
    color: ${theme.textColor};
    opacity: 1;
  }

  .add-account-link__create-account {
    justify-content: center;
    color: ${theme.buttonTextColor3};
    opacity: 1;
  }

  h3 {
    color: ${theme.textColor};
    margin-top: 0;
    font-weight: normal;
    font-size: 24px;
    line-height: 33px;
    text-align: center;
  }

  > .image {
    display: flex;
    justify-content: center;
  }

  .no-accounts {
    margin: 20px 0 50px;
  }

  .no-accounts p {
    text-align: center;
    font-size: 15px;
    line-height: 24px;
    color: ${theme.textColor};
  }
`));
