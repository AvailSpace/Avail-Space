// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { faDiagramProject } from '@fortawesome/free-solid-svg-icons';
import { faCog } from '@fortawesome/free-solid-svg-icons/faCog';
import { faCoins } from '@fortawesome/free-solid-svg-icons/faCoins';
import { faExpand } from '@fortawesome/free-solid-svg-icons/faExpand';
import { faInfoCircle } from '@fortawesome/free-solid-svg-icons/faInfoCircle';
import { faList } from '@fortawesome/free-solid-svg-icons/faList';
import { faLock } from '@fortawesome/free-solid-svg-icons/faLock';
import { faPlug } from '@fortawesome/free-solid-svg-icons/faPlug';
import { faQrcode } from '@fortawesome/free-solid-svg-icons/faQrcode';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconMaps } from '@subwallet/extension-koni-ui/assets/icon';
import { Link } from '@subwallet/extension-koni-ui/components';
import useIsPopup from '@subwallet/extension-koni-ui/hooks/useIsPopup';
import useTranslation from '@subwallet/extension-koni-ui/hooks/useTranslation';
import { windowOpen } from '@subwallet/extension-koni-ui/messaging';
import Header from '@subwallet/extension-koni-ui/partials/Header';
import { RootState } from '@subwallet/extension-koni-ui/stores';
import { ThemeProps } from '@subwallet/extension-koni-ui/types';
import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import settings from '@polkadot/ui-settings';

interface Props extends ThemeProps {
  className?: string;
}

const SettingPath = '/account/settings';

function Settings ({ className }: Props): React.ReactElement {
  const { t } = useTranslation();

  const isLocked = useSelector((state: RootState) => state.keyringState.isLocked);
  const hasMasterPassword = useSelector((state: RootState) => state.keyringState.hasMasterPassword);

  const [camera, setCamera] = useState(settings.camera === 'on');
  const isPopup = useIsPopup();
  const _onWindowOpen = useCallback(
    () => windowOpen('/').catch(console.error),
    []
  );

  useEffect(() => {
    settings.set({ camera: camera ? 'on' : 'off' });
  }, [camera]);

  const onChangeCameraAccess = useCallback(() => {
    setCamera(!camera);

    if (!camera && isPopup) {
      window.localStorage.setItem('popupNavigation', SettingPath);
      windowOpen(SettingPath).catch(console.error);
    }
  }, [camera, isPopup]);

  return (
    <div className={className}>
      <Header
        showBackArrow
        showSubHeader
        subHeaderName={t<string>('Settings')}
      />
      <div className='menu-setting-item-list'>
        <a
          className='menu-setting-item'
          href='https://linktr.ee/subwallet.app'
          rel='noreferrer'
          target='_blank'
        >
          {/* @ts-ignore */}
          <FontAwesomeIcon icon={faInfoCircle} />
          <div className='menu-setting-item__text'>{t<string>('About')}</div>
          {/* @ts-ignore */}
          <div className='menu-setting-item__toggle' />
        </a>

        <Link
          className='menu-setting-item'
          to='/account/general-setting'
        >
          {/* @ts-ignore */}
          <FontAwesomeIcon icon={faCog} />
          <div className='menu-setting-item__text'>{t<string>('General')}</div>
          {/* @ts-ignore */}
          <div className='menu-setting-item__toggle' />
        </Link>

        <Link
          className='menu-setting-item'
          to='/account/networks'
        >
          {/* @ts-ignore */}
          <FontAwesomeIcon icon={faPlug} />
          <div className='menu-setting-item__text'>{t<string>('Networks')}</div>
          <div className='menu-setting-item__toggle' />
        </Link>

        <Link
          className='menu-setting-item'
          to='/auth-list'
        >
          {/* @ts-ignore */}
          <FontAwesomeIcon icon={faList} />
          <div className='menu-setting-item__text'>{t<string>('Manage Website Access')}</div>
          {/* @ts-ignore */}
          <div className='menu-setting-item__toggle' />
        </Link>

        <Link
          className='menu-setting-item'
          to='/account/token-setting'
        >
          {/* @ts-ignore */}
          <FontAwesomeIcon icon={faCoins} />
          <div className='menu-setting-item__text'>{t<string>('Manage Tokens')}</div>
          {/* @ts-ignore */}
          <div className='menu-setting-item__toggle' />
        </Link>

        {isPopup && <div
          className='menu-setting-item'
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onClick={_onWindowOpen}
        >
          {/* @ts-ignore */}
          <FontAwesomeIcon icon={faExpand} />
          <div className='menu-setting-item__text'>{t<string>('Open extension in new window')}</div>
          {/* @ts-ignore */}
          <div className='menu-setting-item__toggle' />
        </div>
        }

        <div
          className='menu-setting-item'
          onClick={onChangeCameraAccess}
        >
          {/* @ts-ignore */}
          <FontAwesomeIcon icon={faQrcode} />
          <div className='menu-setting-item__text'>{t<string>('Allow QR Camera Access')}</div>
          {camera
            ? (
              <div className='account-checked'>
                {IconMaps.check}
              </div>
            )
            : (
              <div className='account-checked account-unchecked-item' />
            )
          }
        </div>

        {/* <Link */}
        {/*  className='menu-setting-item' */}
        {/*  isDisabled */}
        {/*  to='' */}
        {/* > */}
        {/*  /!* @ts-ignore *!/ */}
        {/*  <FontAwesomeIcon icon={faSlidersH} /> */}
        {/*  <div className='menu-setting-item__text'>{t<string>('Advanced')}</div> */}
        {/*  <div className='menu-setting-item__toggle' /> */}
        {/* </Link> */}

        {/* <Link */}
        {/*  className='menu-setting-item' */}
        {/*  isDisabled */}
        {/*  to='' */}
        {/* > */}
        {/*  /!* @ts-ignore *!/ */}
        {/*  <FontAwesomeIcon icon={faIdBadge} /> */}
        {/*  <div className='menu-setting-item__text'>{t<string>('Contacts')}</div> */}
        {/*  <div className='menu-setting-item__toggle' /> */}
        {/* </Link> */}

        <a
          className='menu-setting-item'
          href='https://docs.subwallet.app/privacy-and-security/privacy-policy'
          rel='noreferrer'
          target='_blank'
        >
          {/* @ts-ignore */}
          <FontAwesomeIcon icon={faLock} />
          <div className='menu-setting-item__text'>{t<string>('Security & Privacy')}</div>
          <div className='menu-setting-item__toggle' />
        </a>

        {
          hasMasterPassword && !isLocked && (
            <Link
              className='menu-setting-item'
              to={'/keyring/change'}
            >
              <FontAwesomeIcon icon={faDiagramProject} />
              <div className='menu-setting-item__text'>{t<string>('Change master password')}</div>
              <div className='menu-setting-item__toggle' />
            </Link>
          )
        }
      </div>

    </div>
  );
}

export default styled(Settings)(({ theme }: Props) => `
  display: flex;
  flex-direction: column;
  height: 100%;

  .menu-setting-item-list {
    padding: 12px 22px;
    flex: 1;
    overflow: auto;
  }

  .menu-setting-item {
    position: relative;
    border-radius: 5px;
    display: flex;
    align-items: center;
    padding: 9px 11px;
    opacity: 1;

    .svg-inline--fa {
      color: ${theme.iconNeutralColor};
      margin-right: 11px;
      width: 15px;
    }
  }

  .menu-setting-item:hover {
    background-color: ${theme.backgroundAccountAddress};
    cursor: pointer;

    .menu-setting-item__toggle {
      color:  ${theme.textColor};
    }

    .svg-inline--fa,
    .menu-setting-item__text {
      color: ${theme.buttonTextColor2};
    }
  }

  .menu-setting-item__text {
    font-size: 18px;
    line-height: 30px;
    font-weight: 500;
    color: ${theme.textColor2};
  }

  .menu-setting-item__toggle {
    position: absolute;
    border-style: solid;
    border-width: 0 2px 2px 0;
    display: inline-block;
    padding: 3px;
    transform: rotate(-45deg);
    right: 25px;
    color: ${theme.background};
  }

  .account-checked {
    position: absolute;
    right: 25px;
    color: ${theme.primaryColor}
  }
`);
