// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { AccountJson, AccountsContext, AuthorizeRequest, MetadataRequest, SigningRequest } from '@subwallet/extension-base/background/types';
import type { SettingsStruct } from '@polkadot/ui-settings/types';

import { AccountsWithCurrentAddress, ConfirmationsQueue, ConfirmationType, CurrentAccountInfo } from '@subwallet/extension-base/background/KoniTypes';
import { PHISHING_PAGE_REDIRECT } from '@subwallet/extension-base/defaults';
import { canDerive } from '@subwallet/extension-base/utils';
import { ALL_ACCOUNT_KEY } from '@subwallet/extension-koni-base/constants';
import { AccountContext, ActionContext, AuthorizeReqContext, ConfirmationsQueueContext, MediaContext, MetadataReqContext, SettingsContext, SigningReqContext } from '@subwallet/extension-koni-ui/contexts';
import { ExternalRequestContextProvider } from '@subwallet/extension-koni-ui/contexts/ExternalRequestContext';
import { QRContextProvider } from '@subwallet/extension-koni-ui/contexts/QrContext';
import useSetupStore from '@subwallet/extension-koni-ui/hooks/store/useSetupStore';
import ExternalRequest from '@subwallet/extension-koni-ui/Popup/ExternalRequest';
import Home from '@subwallet/extension-koni-ui/Popup/Home';
import XcmTransfer from '@subwallet/extension-koni-ui/Popup/XcmTransfer/XcmTransfer';
import { updateCurrentAccount } from '@subwallet/extension-koni-ui/stores/updater';
import * as Bowser from 'bowser';
import React, { useCallback, useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { Route, Switch } from 'react-router';

import uiSettings from '@polkadot/ui-settings';

import ToastProvider from '../components/Toast/ToastProvider';
import { ScannerContextProvider } from '../contexts/ScannerContext';
import { saveCurrentAccountAddress, subscribeAccountsWithCurrentAddress, subscribeAuthorizeRequestsV2, subscribeConfirmations, subscribeMetadataRequests, subscribeSigningRequests } from '../messaging';
import { store } from '../stores';
import { createFindAccountHandler } from '../util/account';
import { buildHierarchy } from '../util/buildHierarchy';
// import Home from './Home';

const StakeCompoundSubmitTransaction = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Home/Staking/StakeCompoundSubmitTransaction'));
const UnbondingSubmitTransaction = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Bonding/UnbondingSubmitTransaction'));
const BondingSubmitTransaction = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Bonding/BondingSubmitTransaction'));
const BondingValidatorSelection = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Bonding/BondingValidatorSelection'));
const BondingNetworkSelection = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Bonding/BondingNetworkSelection'));
const TokenEdit = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Settings/TokenSetting/CustomTokenEdit'));
const TokenSetting = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Settings/TokenSetting/CustomTokenSetting'));
const Welcome = React.lazy(() => import('./Welcome'));
const Signing = React.lazy(() => import('./Signing'));
const Confirmation = React.lazy(() => import('./Confirmation'));
const RestoreJson = React.lazy(() => import('./RestoreJson'));
const PhishingDetected = React.lazy(() => import('./PhishingDetected'));
const Metadata = React.lazy(() => import('./Metadata'));
const ImportSeed = React.lazy(() => import('./ImportSeed'));
const ImportQr = React.lazy(() => import('./ImportQr'));
const ImportMetamaskPrivateKey = React.lazy(() => import('./ImportMetamaskPrivateKey'));
const Forget = React.lazy(() => import('./Forget'));
const Export = React.lazy(() => import('./Export'));
const Derive = React.lazy(() => import('./Derive'));
const CreateAccount = React.lazy(() => import('./CreateAccount'));
const Authorize = React.lazy(() => import('./Authorize'));
const AuthList = React.lazy(() => import('./AuthManagement'));
const LoadingContainer = React.lazy(() => import('@subwallet/extension-koni-ui/components/LoadingContainer'));
const TransferNftContainer = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Home/Nfts/transfer/TransferNftContainer'));
const ImportLedger = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/ImportLedger'));
const ImportNft = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/ImportToken/ImportNft'));
const ImportToken = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/ImportToken/ImportToken'));
const SendFund = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Sending/SendFund'));
const Settings = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Settings'));
const GeneralSetting = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Settings/GeneralSetting'));
const NetworkCreate = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Settings/NetworkSettings/NetworkEdit'));
const Networks = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Settings/NetworkSettings/Networks'));
const Rendering = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Rendering'));
const Donate = React.lazy(() => import('@subwallet/extension-koni-ui/Popup/Sending/Donate'));
const ErrorBoundary = React.lazy(() => import('../components/ErrorBoundary'));

const startSettings = uiSettings.get();

// Request permission for video, based on access we can hide/show import
async function requestMediaAccess (cameraOn: boolean): Promise<boolean> {
  if (!cameraOn) {
    return false;
  }

  try {
    await navigator.mediaDevices.getUserMedia({ video: true });

    return true;
  } catch (error) {
    console.error('Permission for video declined', (error as Error).message);
  }

  return false;
}

function initAccountContext (accounts: AccountJson[]): AccountsContext {
  const hierarchy = buildHierarchy(accounts);
  const master = hierarchy.find(({ isExternal, type }) => !isExternal && canDerive(type));

  const getAccountByAddress = createFindAccountHandler(accounts);

  return {
    accounts,
    hierarchy,
    master,
    getAccountByAddress
  };
}

const VARIANTS = ['beam', 'marble', 'pixel', 'sunset', 'bauhaus', 'ring'];

function getRandomVariant (): string {
  const random = Math.floor(Math.random() * 6);

  return VARIANTS[random];
}

export default function Popup (): React.ReactElement {
  const [accounts, setAccounts] = useState<null | AccountJson[]>(null);
  const [accountCtx, setAccountCtx] = useState<AccountsContext>({
    accounts: [],
    hierarchy: [],
    getAccountByAddress: createFindAccountHandler([])
  });
  const [authRequests, setAuthRequests] = useState<null | AuthorizeRequest[]>(null);
  const [cameraOn, setCameraOn] = useState(startSettings.camera === 'on');
  const [mediaAllowed, setMediaAllowed] = useState(false);
  const [metaRequests, setMetaRequests] = useState<null | MetadataRequest[]>(null);
  const [signRequests, setSignRequests] = useState<null | SigningRequest[]>(null);
  const [confirmations, setConfirmations] = useState<ConfirmationsQueue>({
    addNetworkRequest: {},
    addTokenRequest: {},
    switchNetworkRequest: {},
    evmSignatureRequest: {},
    evmSignatureRequestQr: {},
    evmSendTransactionRequest: {},
    evmSendTransactionRequestQr: {}
  });
  const [isWelcomeDone, setWelcomeDone] = useState(false);
  const [settingsCtx, setSettingsCtx] = useState<SettingsStruct>(startSettings);
  const browser = Bowser.getParser(window.navigator.userAgent);

  if (!window.localStorage.getItem('randomVariant') || !window.localStorage.getItem('randomNameForLogo')) {
    const randomVariant = getRandomVariant();

    window.localStorage.setItem('randomVariant', randomVariant);
    window.localStorage.setItem('randomNameForLogo', `${Date.now()}`);
  }

  if (!!browser.getBrowser() && !!browser.getBrowser().name && !!browser.getOS().name) {
    window.localStorage.setItem('browserInfo', browser.getBrowser().name as string);
    window.localStorage.setItem('osInfo', browser.getOS().name as string);
  }

  const _onAction = useCallback(
    (to?: string): void => {
      setWelcomeDone(window.localStorage.getItem('welcome_read') === 'ok');

      if (to) {
        window.location.hash = to;
      }
    },
    []
  );

  // @ts-ignore
  const handleGetAccountsWithCurrentAddress = (data: AccountsWithCurrentAddress) => {
    const { accounts, currentAddress, currentGenesisHash } = data;

    if (accounts && accounts.length === 0) {
      accounts.push({ address: currentAddress || ALL_ACCOUNT_KEY, genesisHash: currentGenesisHash });
    }

    setAccounts(accounts);

    if (accounts && accounts.length) {
      let selectedAcc = accounts.find((acc) => acc.address === currentAddress);

      if (!selectedAcc) {
        selectedAcc = accounts[0];
        selectedAcc.genesisHash = currentGenesisHash;

        const accountInfo = {
          address: selectedAcc.address,
          currentGenesisHash
        } as CurrentAccountInfo;

        saveCurrentAccountAddress(accountInfo, () => {
          updateCurrentAccount(selectedAcc as AccountJson);
        }).catch((e) => {
          console.error('There is a problem when set Current Account', e);
        });
      } else {
        selectedAcc.genesisHash = currentGenesisHash;
        updateCurrentAccount(selectedAcc);
      }
    }
  };

  const checkConfirmation = useCallback(
    (type?: ConfirmationType) => {
      if (type) {
        return confirmations[type] && Object.keys(confirmations[type]).length > 0;
      } else {
        return !!Object.values(confirmations).find((c) => (Object.keys(c).length > 0));
      }
    },
    [confirmations]
  );

  useEffect(() => {
    const handleConfirmations = (confirmations: ConfirmationsQueue) => {
      setConfirmations(confirmations);
    };

    subscribeConfirmations(handleConfirmations)
      .then(handleConfirmations)
      .catch(console.error);
  }, []);

  useEffect((): void => {
    setWelcomeDone(window.localStorage.getItem('welcome_read') === 'ok');
    const beforeNav = window.localStorage.getItem('popupNavigation');

    if (authRequests?.length || metaRequests?.length || signRequests?.length || checkConfirmation()) {
      window.location.hash = '/';
    } else if (beforeNav) {
      window.location.hash = beforeNav;
    }
  }, [authRequests, checkConfirmation, metaRequests, signRequests]);

  useEffect((): void => {
    Promise.all([
      // subscribeAccounts(setAccounts),
      subscribeAccountsWithCurrentAddress(handleGetAccountsWithCurrentAddress),
      subscribeAuthorizeRequestsV2(setAuthRequests),
      subscribeMetadataRequests(setMetaRequests),
      subscribeSigningRequests(setSignRequests)
    ]).catch(console.error);

    uiSettings.on('change', (settings): void => {
      setSettingsCtx(settings);
      setCameraOn(settings.camera === 'on');
    });
  }, []);

  useSetupStore();

  useEffect((): void => {
    setAccountCtx(initAccountContext(accounts || []));
  }, [accounts]);

  useEffect((): void => {
    requestMediaAccess(cameraOn)
      .then(setMediaAllowed)
      .catch(console.error);
  }, [cameraOn]);

  function wrapWithErrorBoundary (component: React.ReactElement, trigger?: string): React.ReactElement {
    return <ErrorBoundary trigger={trigger}>{component}</ErrorBoundary>;
  }

  const Root = isWelcomeDone
    ? authRequests && authRequests.length
      ? wrapWithErrorBoundary(<Authorize />, 'authorize')
      : metaRequests && metaRequests.length
        ? wrapWithErrorBoundary(<Metadata />, 'metadata')
        : signRequests && signRequests.length
          ? wrapWithErrorBoundary(<Signing />, 'signing')
          : checkConfirmation()
            ? wrapWithErrorBoundary(<Confirmation />, 'confirmation')
            : wrapWithErrorBoundary(<Home />, 'Home')
    : wrapWithErrorBoundary(<Welcome />, 'welcome');

  return (
    <LoadingContainer>{accounts && authRequests && metaRequests && signRequests && (
      <Provider store={store}>
        <ActionContext.Provider value={_onAction}>
          <div id='tooltips' />
          <SettingsContext.Provider value={settingsCtx}>
            <AccountContext.Provider value={accountCtx}>
              <AuthorizeReqContext.Provider value={authRequests}>
                <MediaContext.Provider value={cameraOn && mediaAllowed}>
                  <MetadataReqContext.Provider value={metaRequests}>
                    <SigningReqContext.Provider value={signRequests}>
                      <ConfirmationsQueueContext.Provider value={confirmations}>
                        <ExternalRequestContextProvider>
                          <ScannerContextProvider>
                            <QRContextProvider>
                              <ToastProvider>
                                <Rendering />
                                <Switch>
                                  <Route path='/auth-list'>{wrapWithErrorBoundary(<AuthList />, 'auth-list')}</Route>
                                  <Route path='/confirmation'>{wrapWithErrorBoundary(<AuthList />, 'confirmation')}</Route>
                                  <Route path='/account/create'>{wrapWithErrorBoundary(<CreateAccount />, 'account-creation')}</Route>
                                  <Route path='/account/forget/:address'>{wrapWithErrorBoundary(<Forget />, 'forget-address')}</Route>
                                  <Route path='/account/export/:address'>{wrapWithErrorBoundary(<Export />, 'export-address')}</Route>
                                  {/* <Route path='/account/export-all'>{wrapWithErrorBoundary(<ExportAll />, 'export-all-address')}</Route> */}
                                  <Route path='/account/import-ledger'>{wrapWithErrorBoundary(<ImportLedger />, 'import-ledger')}</Route>
                                  <Route path='/account/import-qr'>{wrapWithErrorBoundary(<ImportQr />, 'import-qr')}</Route>
                                  <Route path='/account/scan-qr'>{wrapWithErrorBoundary(<ExternalRequest />, 'scan-qr')}</Route>
                                  <Route path='/account/import-seed'>{wrapWithErrorBoundary(<ImportSeed />, 'import-seed')}</Route>
                                  <Route path='/account/import-metamask-private-key'>{wrapWithErrorBoundary(<ImportMetamaskPrivateKey />, 'import-metamask-private-key')}</Route>
                                  <Route path='/account/restore-json'>{wrapWithErrorBoundary(<RestoreJson />, 'restore-json')}</Route>
                                  <Route path='/account/derive/:address/locked'>{wrapWithErrorBoundary(<Derive isLocked />, 'derived-address-locked')}</Route>
                                  <Route path='/account/derive/:address'>{wrapWithErrorBoundary(<Derive />, 'derive-address')}</Route>
                                  <Route path='/account/settings'>{wrapWithErrorBoundary(<Settings />, 'account-settings')}</Route>
                                  <Route path='/account/general-setting'>{wrapWithErrorBoundary(<GeneralSetting />, 'account-general-settings')}</Route>
                                  <Route path='/account/networks'>{wrapWithErrorBoundary(<Networks />, 'account-networks')}</Route>
                                  <Route path='/account/config-network'>{wrapWithErrorBoundary(<NetworkCreate />, 'account-network-edit')}</Route>
                                  <Route path='/account/xcm-transfer'>{wrapWithErrorBoundary(<XcmTransfer />, 'xcm-transfer')}</Route>
                                  <Route path='/account/send-fund'>{wrapWithErrorBoundary(<SendFund />, 'send-fund')}</Route>
                                  <Route path='/account/donate'>{wrapWithErrorBoundary(<Donate />, 'donate')}</Route>
                                  <Route path='/account/send-nft'>{wrapWithErrorBoundary(<TransferNftContainer />, 'send-nft')}</Route>
                                  <Route path='/account/import-token'>{wrapWithErrorBoundary(<ImportToken />, 'import-token')}</Route>
                                  <Route path='/account/import-nft'>{wrapWithErrorBoundary(<ImportNft />, 'import-nft')}</Route>
                                  <Route path='/account/token-setting'>{wrapWithErrorBoundary(<TokenSetting />, 'token-setting')}</Route>
                                  <Route path='/account/token-edit'>{wrapWithErrorBoundary(<TokenEdit />, 'token-edit')}</Route>
                                  <Route path='/account/select-bonding-network'>{wrapWithErrorBoundary(<BondingNetworkSelection />, 'bonding-network')}</Route>
                                  <Route path='/account/select-bonding-validator'>{wrapWithErrorBoundary(<BondingValidatorSelection />, 'bonding-validator')}</Route>
                                  <Route path='/account/bonding-auth'>{wrapWithErrorBoundary(<BondingSubmitTransaction />, 'bonding-auth')}</Route>
                                  <Route path='/account/unbonding-auth'>{wrapWithErrorBoundary(<UnbondingSubmitTransaction />, 'unbonding-auth')}</Route>
                                  <Route path='/account/stake-compounding-auth'>{wrapWithErrorBoundary(<StakeCompoundSubmitTransaction />, 'stake-compounding-auth')}</Route>
                                  <Route path={`${PHISHING_PAGE_REDIRECT}/:website`}>{wrapWithErrorBoundary(<PhishingDetected />, 'phishing-page-redirect')}</Route>
                                  <Route
                                    exact
                                    path='/'
                                  >
                                    {Root}
                                  </Route>
                                </Switch>
                              </ToastProvider>
                            </QRContextProvider>
                          </ScannerContextProvider>
                        </ExternalRequestContextProvider>
                      </ConfirmationsQueueContext.Provider>
                    </SigningReqContext.Provider>
                  </MetadataReqContext.Provider>
                </MediaContext.Provider>
              </AuthorizeReqContext.Provider>
            </AccountContext.Provider>
          </SettingsContext.Provider>
        </ActionContext.Provider>
      </Provider>
    )}</LoadingContainer>
  );
}
