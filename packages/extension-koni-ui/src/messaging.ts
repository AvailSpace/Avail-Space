// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { AccountJson, AllowedPath, AuthorizeRequest, MessageTypes, MessageTypesWithNoSubscriptions, MessageTypesWithNullRequest, MessageTypesWithSubscriptions, MetadataRequest, RequestTypes, ResponseAuthorizeList, ResponseDeriveValidate, ResponseJsonGetAccountInfo, ResponseSigningIsLocked, ResponseTypes, SeedLengths, SigningRequest, SubscriptionMessageTypes } from '@subwallet/extension-base/background/types';
import type { Message } from '@subwallet/extension-base/types';
import type { Chain } from '@subwallet/extension-chains/types';
import type { KeyringPair$Json } from '@subwallet/keyring/types';
import type { KeyringPairs$Json } from '@subwallet/ui-keyring/types';
import type { HexString } from '@polkadot/util/types';
import type { KeypairType } from '@polkadot/util-crypto/types';

import { _ChainAsset, _ChainInfo } from '@subwallet/chain-list/types';
import { AuthUrls } from '@subwallet/extension-base/background/handlers/State';
import { AccountExternalError, AccountsWithCurrentAddress, BalanceJson, BasicTxInfo, BasicTxResponse, BondingOptionInfo, BondingSubmitParams, ChainBondingBasics, CheckExistingTuringCompoundParams, ConfirmationDefinitions, ConfirmationsQueue, ConfirmationType, CrowdloanJson, CurrentAccountInfo, CustomTokenJson, DelegationItem, DisableNetworkResponse, EvmNftTransaction, ExistingTuringCompoundTask, KeyringState, NetworkJson, NftCollection, NftJson, NftTransactionRequest, NftTransactionResponse, NftTransferExtra, OptionInputAddress, PriceJson, RequestAccountCreateExternalV2, RequestAccountCreateHardwareV2, RequestAccountCreateSuriV2, RequestAccountCreateWithSecretKey, RequestAccountMeta, RequestAuthorizationBlock, RequestAuthorizationPerSite, RequestBondingSubmit, RequestCancelCompoundStakeExternal, RequestChangeMasterPassword, RequestCheckCrossChainTransfer, RequestCheckTransfer, RequestClaimRewardExternal, RequestCreateCompoundStakeExternal, RequestCrossChainTransfer, RequestCrossChainTransferExternal, RequestDeriveCreateMultiple, RequestDeriveValidateV2, RequestEvmNftSubmitTransaction, RequestFreeBalance, RequestGetDeriveAccounts, RequestJsonRestoreV2, RequestKeyringExportMnemonic, RequestMigratePassword, RequestNftForceUpdate, RequestNftTransferExternalEVM, RequestNftTransferExternalSubstrate, RequestParseEVMContractInput, RequestParseTransactionSubstrate, RequestQrSignEVM, RequestQrSignSubstrate, RequestRejectExternalRequest, RequestResolveExternalRequest, RequestSettingsType, RequestSigningApprovePasswordV2, RequestStakeClaimReward, RequestStakeExternal, RequestStakeWithdrawal, RequestSubscribeBalance, RequestSubscribeBalancesVisibility, RequestSubscribeCrowdloan, RequestSubscribeNft, RequestSubscribePrice, RequestSubscribeStaking, RequestSubscribeStakingReward, RequestSubstrateNftSubmitTransaction, RequestTransfer, RequestTransferCheckReferenceCount, RequestTransferCheckSupporting, RequestTransferExistentialDeposit, RequestTransferExternal, RequestTuringCancelStakeCompound, RequestTuringStakeCompound, RequestUnbondingSubmit, RequestUnlockKeyring, RequestUnStakeExternal, RequestWithdrawStakeExternal, ResponseAccountCreateSuriV2, ResponseAccountCreateWithSecretKey, ResponseAccountExportPrivateKey, ResponseAccountIsLocked, ResponseAccountMeta, ResponseChangeMasterPassword, ResponseCheckCrossChainTransfer, ResponseCheckPublicAndSecretKey, ResponseCheckTransfer, ResponseDeriveValidateV2, ResponseGetDeriveAccounts, ResponseKeyringExportMnemonic, ResponseMigratePassword, ResponseParseEVMContractInput, ResponseParseTransactionSubstrate, ResponsePrivateKeyValidateV2, ResponseQrParseRLP, ResponseQrSignEVM, ResponseQrSignSubstrate, ResponseRejectExternalRequest, ResponseResolveExternalRequest, ResponseSeedCreateV2, ResponseSeedValidateV2, ResponseUnlockKeyring, StakeClaimRewardParams, StakeDelegationRequest, StakeUnlockingJson, StakeWithdrawalParams, StakingJson, StakingRewardJson, SubstrateNftTransaction, SupportTransferResponse, ThemeTypes, TuringCancelStakeCompoundParams, TuringStakeCompoundParams, TuringStakeCompoundResp, TxHistoryItem, UiSettings, UnbondingSubmitParams, ValidateNetworkResponse } from '@subwallet/extension-base/background/KoniTypes';
import { RequestCurrentAccountAddress } from '@subwallet/extension-base/background/types';
import { PORT_EXTENSION } from '@subwallet/extension-base/defaults';
import { _ChainState, _ValidateCustomTokenRequest } from '@subwallet/extension-base/services/chain-service/types';
import { getId } from '@subwallet/extension-base/utils/getId';
import { metadataExpand } from '@subwallet/extension-chains';
import { MetadataDef } from '@subwallet/extension-inject/types';
import { SingleAddress } from '@subwallet/ui-keyring/observable/types';

import { _getKnownHashes, _getKnownNetworks } from './util/defaultChains';
import { getSavedMeta, setSavedMeta } from './MetadataCache';

interface Handler {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolve: (data: any) => void;
  reject: (error: Error) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscriber?: (data: any) => void;
}

type Handlers = Record<string, Handler>;

const port = chrome.runtime.connect({ name: PORT_EXTENSION });
const handlers: Handlers = {};

// setup a listener for messages, any incoming resolves the promise
port.onMessage.addListener((data: Message['data']): void => {
  const handler = handlers[data.id];

  if (!handler) {
    console.error(`Unknown response: ${JSON.stringify(data)}`);

    return;
  }

  if (!handler.subscriber) {
    delete handlers[data.id];
  }

  if (data.subscription) {
    // eslint-disable-next-line @typescript-eslint/ban-types
    (handler.subscriber as Function)(data.subscription);
  } else if (data.error) {
    handler.reject(new Error(data.error));
  } else {
    handler.resolve(data.response);
  }
});

function sendMessage<TMessageType extends MessageTypesWithNullRequest> (message: TMessageType): Promise<ResponseTypes[TMessageType]>;
function sendMessage<TMessageType extends MessageTypesWithNoSubscriptions> (message: TMessageType, request: RequestTypes[TMessageType]): Promise<ResponseTypes[TMessageType]>;
function sendMessage<TMessageType extends MessageTypesWithSubscriptions> (message: TMessageType, request: RequestTypes[TMessageType], subscriber: (data: SubscriptionMessageTypes[TMessageType]) => void): Promise<ResponseTypes[TMessageType]>;
function sendMessage<TMessageType extends MessageTypes> (message: TMessageType, request?: RequestTypes[TMessageType], subscriber?: (data: unknown) => void): Promise<ResponseTypes[TMessageType]> {
  return new Promise((resolve, reject): void => {
    const id = getId();

    handlers[id] = { reject, resolve, subscriber };

    port.postMessage({ id, message, request: request || {} });
  });
}

export function lazySendMessage<TMessageType extends MessageTypesWithSubscriptions> (message: TMessageType, request: RequestTypes[TMessageType]): {promise: Promise<ResponseTypes[TMessageType]>, start: () => void} {
  const id = getId();
  const handlePromise = new Promise((resolve, reject): void => {
    handlers[id] = { reject, resolve };
  });

  return {
    promise: handlePromise as Promise<ResponseTypes[TMessageType]>,
    start: () => {
      port.postMessage({ id, message, request: request || {} });
    }
  };
}

export function lazySubscribeMessage<TMessageType extends MessageTypesWithSubscriptions> (message: TMessageType, request: RequestTypes[TMessageType], callback: (data: ResponseTypes[TMessageType]) => void, subscriber: (data: SubscriptionMessageTypes[TMessageType]) => void): {promise: Promise<ResponseTypes[TMessageType]>, start: () => void, unsub: () => void} {
  const id = getId();
  let cancel = false;
  const handlePromise = new Promise((resolve, reject): void => {
    handlers[id] = { reject, resolve, subscriber };
  });

  const rs = {
    promise: handlePromise as Promise<ResponseTypes[TMessageType]>,
    start: () => {
      port.postMessage({ id, message, request: request || {} });
    },
    unsub: () => {
      const handler = handlers[id];

      cancel = true;

      if (handler) {
        delete handler.subscriber;
        handler.resolve(null);
      }
    }
  };

  rs.promise.then((data) => {
    !cancel && callback(data);
  }).catch(console.error);

  return rs;
}

export function subscribeMessage<TMessageType extends MessageTypesWithSubscriptions> (message: TMessageType, request: RequestTypes[TMessageType], callback: (data: ResponseTypes[TMessageType]) => void, subscriber: (data: SubscriptionMessageTypes[TMessageType]) => void): {promise: Promise<ResponseTypes[TMessageType]>, unsub: () => void} {
  const lazyItem = lazySubscribeMessage(message, request, callback, subscriber);

  lazyItem.start();

  return {
    promise: lazyItem.promise,
    unsub: lazyItem.unsub
  };
}

export async function editAccount (address: string, name: string): Promise<boolean> {
  return sendMessage('pri(accounts.edit)', { address, name });
}

export async function showAccount (address: string, isShowing: boolean): Promise<boolean> {
  return sendMessage('pri(accounts.show)', { address, isShowing });
}

export async function saveCurrentAccountAddress (data: RequestCurrentAccountAddress, callback: (data: CurrentAccountInfo) => void): Promise<boolean> {
  return sendMessage('pri(currentAccount.saveAddress)', data, callback);
}

export async function toggleBalancesVisibility (callback: (data: RequestSettingsType) => void): Promise<boolean> {
  return sendMessage('pri(settings.changeBalancesVisibility)', null, callback);
}

export async function saveAccountAllLogo (accountAllLogo: string, callback: (data: RequestSettingsType) => void): Promise<boolean> {
  return sendMessage('pri(settings.saveAccountAllLogo)', accountAllLogo, callback);
}

export async function saveTheme (theme: ThemeTypes, callback: (data: RequestSettingsType) => void): Promise<boolean> {
  return sendMessage('pri(settings.saveTheme)', theme, callback);
}

export async function subscribeSettings (data: RequestSubscribeBalancesVisibility, callback: (data: UiSettings) => void): Promise<UiSettings> {
  return sendMessage('pri(settings.subscribe)', data, callback);
}

export async function tieAccount (address: string, genesisHash: string | null): Promise<boolean> {
  return sendMessage('pri(accounts.tie)', { address, genesisHash });
}

export async function exportAccount (address: string, password: string): Promise<{ exportedJson: KeyringPair$Json }> {
  return sendMessage('pri(accounts.export)', { address, password });
}

export async function exportAccountPrivateKey (address: string, password: string): Promise<ResponseAccountExportPrivateKey> {
  return sendMessage('pri(accounts.exportPrivateKey)', { address, password });
}

export async function exportAccounts (addresses: string[], password: string): Promise<{ exportedJson: KeyringPairs$Json }> {
  return sendMessage('pri(accounts.batchExport)', { addresses, password });
}

export async function checkPublicAndPrivateKey (publicKey: string, secretKey: string): Promise<ResponseCheckPublicAndSecretKey> {
  return sendMessage('pri(accounts.checkPublicAndSecretKey)', { publicKey, secretKey });
}

export async function validateAccount (address: string, password: string): Promise<boolean> {
  return sendMessage('pri(accounts.validate)', { address, password });
}

export async function forgetAccount (address: string): Promise<boolean> {
  return sendMessage('pri(accounts.forget)', { address });
}

export async function approveAuthRequest (id: string): Promise<boolean> {
  return sendMessage('pri(authorize.approve)', { id });
}

export async function approveAuthRequestV2 (id: string, accounts: string[]): Promise<boolean> {
  return sendMessage('pri(authorize.approveV2)', { id, accounts });
}

export async function approveMetaRequest (id: string): Promise<boolean> {
  return sendMessage('pri(metadata.approve)', { id });
}

export async function cancelSignRequest (id: string): Promise<boolean> {
  return sendMessage('pri(signing.cancel)', { id });
}

export async function isSignLocked (id: string): Promise<ResponseSigningIsLocked> {
  return sendMessage('pri(signing.isLocked)', { id });
}

export async function approveSignPassword (id: string, savePass: boolean, password?: string): Promise<boolean> {
  return sendMessage('pri(signing.approve.password)', { id, password, savePass });
}

export async function approveSignPasswordV2 (request: RequestSigningApprovePasswordV2): Promise<boolean> {
  return sendMessage('pri(signing.approve.passwordV2)', request);
}

export async function approveSignSignature (id: string, signature: HexString): Promise<boolean> {
  return sendMessage('pri(signing.approve.signature)', { id, signature });
}

export async function createAccountExternal (name: string, address: string, genesisHash: string): Promise<boolean> {
  return sendMessage('pri(accounts.create.external)', { address, genesisHash, name });
}

export async function createAccountExternalV2 (request: RequestAccountCreateExternalV2): Promise<AccountExternalError[]> {
  return sendMessage('pri(accounts.create.externalV2)', request);
}

export async function createAccountHardware (address: string, hardwareType: string, accountIndex: number, addressOffset: number, name: string, genesisHash: string): Promise<boolean> {
  return sendMessage('pri(accounts.create.hardware)', { accountIndex, address, addressOffset, genesisHash, hardwareType, name });
}

export async function createAccountHardwareV2 (request: RequestAccountCreateHardwareV2): Promise<boolean> {
  return sendMessage('pri(accounts.create.hardwareV2)', request);
}

export async function createAccountSuri (name: string, password: string, suri: string, type?: KeypairType, genesisHash?: string): Promise<boolean> {
  return sendMessage('pri(accounts.create.suri)', { genesisHash, name, password, suri, type });
}

export async function createAccountSuriV2 (request: RequestAccountCreateSuriV2): Promise<ResponseAccountCreateSuriV2> {
  return sendMessage('pri(accounts.create.suriV2)', request);
}

export async function createSeed (length?: SeedLengths, seed?: string, type?: KeypairType): Promise<{ address: string; seed: string }> {
  return sendMessage('pri(seed.create)', { length, seed, type });
}

export async function createSeedV2 (length?: SeedLengths, seed?: string, types?: Array<KeypairType>): Promise<ResponseSeedCreateV2> {
  return sendMessage('pri(seed.createV2)', { length, seed, types });
}

export async function createAccountWithSecret (request: RequestAccountCreateWithSecretKey): Promise<ResponseAccountCreateWithSecretKey> {
  return sendMessage('pri(accounts.create.withSecret)', request);
}

export async function getAllMetadata (): Promise<MetadataDef[]> {
  return sendMessage('pri(metadata.list)');
}

export async function getMetadata (genesisHash?: string | null, isPartial = false): Promise<Chain | null> {
  if (!genesisHash) {
    return null;
  }

  const chains = await getNetworkMap();
  const parsedChains = _getKnownHashes(chains);

  let request = getSavedMeta(genesisHash);

  if (!request) {
    request = sendMessage('pri(metadata.get)', genesisHash || null);
    setSavedMeta(genesisHash, request);
  }

  const def = await request;

  if (def) {
    return metadataExpand(def, isPartial);
  } else if (isPartial) {
    const chain = parsedChains.find((chain) => chain.genesisHash === genesisHash);

    if (chain) {
      return metadataExpand({
        ...chain,
        specVersion: 0,
        tokenDecimals: 15,
        tokenSymbol: 'Unit',
        types: {}
      }, isPartial);
    }
  }

  return null;
}

export async function getChainMetadata (genesisHash?: string | null): Promise<Chain | null> {
  if (!genesisHash) {
    return null;
  }

  const chains = await getNetworkMap();
  const parsedChains = _getKnownNetworks(chains);

  let request = getSavedMeta(genesisHash);

  if (!request) {
    request = sendMessage('pri(metadata.get)', genesisHash || null);
    setSavedMeta(genesisHash, request);
  }

  const def = await request;

  if (def) {
    return metadataExpand(def, false);
  } else {
    const chain = parsedChains.find((chain) => chain.genesisHash === genesisHash);

    if (chain) {
      return metadataExpand({
        specVersion: 0,
        tokenDecimals: 15,
        tokenSymbol: 'Unit',
        types: {},
        ...chain
      }, false);
    }
  }

  return null;
}

export async function rejectAuthRequest (id: string): Promise<boolean> {
  return sendMessage('pri(authorize.reject)', { id });
}

export async function rejectAuthRequestV2 (id: string): Promise<boolean> {
  return sendMessage('pri(authorize.rejectV2)', { id });
}

export async function cancelAuthRequestV2 (id: string): Promise<boolean> {
  return sendMessage('pri(authorize.cancelV2)', { id });
}

export async function rejectMetaRequest (id: string): Promise<boolean> {
  return sendMessage('pri(metadata.reject)', { id });
}

export async function subscribeAccounts (cb: (accounts: AccountJson[]) => void): Promise<boolean> {
  return sendMessage('pri(accounts.subscribe)', {}, cb);
}

export async function subscribeAccountsWithCurrentAddress (cb: (data: AccountsWithCurrentAddress) => void): Promise<boolean> {
  return sendMessage('pri(accounts.subscribeWithCurrentAddress)', {}, cb);
}

export async function subscribeAccountsInputAddress (cb: (data: OptionInputAddress) => void): Promise<string> {
  return sendMessage('pri(accounts.subscribeAccountsInputAddress)', {}, cb);
}

export async function saveRecentAccountId (accountId: string): Promise<SingleAddress> {
  return sendMessage('pri(accounts.saveRecent)', { accountId });
}

export async function triggerAccountsSubscription (): Promise<boolean> {
  return sendMessage('pri(accounts.triggerSubscription)');
}

export async function subscribeAuthorizeRequests (cb: (accounts: AuthorizeRequest[]) => void): Promise<boolean> {
  return sendMessage('pri(authorize.requests)', null, cb);
}

export async function subscribeAuthorizeRequestsV2 (cb: (accounts: AuthorizeRequest[]) => void): Promise<boolean> {
  return sendMessage('pri(authorize.requestsV2)', null, cb);
}

export async function getAuthList (): Promise<ResponseAuthorizeList> {
  return sendMessage('pri(authorize.list)');
}

export async function getAuthListV2 (): Promise<ResponseAuthorizeList> {
  return sendMessage('pri(authorize.listV2)');
}

export async function toggleAuthorization (url: string): Promise<ResponseAuthorizeList> {
  return sendMessage('pri(authorize.toggle)', url);
}

export async function changeAuthorizationAll (connectValue: boolean, callback: (data: AuthUrls) => void): Promise<boolean> {
  return sendMessage('pri(authorize.changeSiteAll)', { connectValue }, callback);
}

export async function changeAuthorization (connectValue: boolean, url: string, callback: (data: AuthUrls) => void): Promise<boolean> {
  return sendMessage('pri(authorize.changeSite)', { url, connectValue }, callback);
}

export async function changeAuthorizationPerAcc (address: string, connectValue: boolean, url: string, callback: (data: AuthUrls) => void): Promise<boolean> {
  return sendMessage('pri(authorize.changeSitePerAccount)', { address, url, connectValue }, callback);
}

export async function changeAuthorizationPerSite (request: RequestAuthorizationPerSite): Promise<boolean> {
  return sendMessage('pri(authorize.changeSitePerSite)', request);
}

export async function changeAuthorizationBlock (request: RequestAuthorizationBlock): Promise<boolean> {
  return sendMessage('pri(authorize.changeSiteBlock)', request);
}

export async function forgetSite (url: string, callback: (data: AuthUrls) => void): Promise<boolean> {
  return sendMessage('pri(authorize.forgetSite)', { url }, callback);
}

export async function forgetAllSite (callback: (data: AuthUrls) => void): Promise<boolean> {
  return sendMessage('pri(authorize.forgetAllSite)', null, callback);
}

export async function subscribeMetadataRequests (cb: (accounts: MetadataRequest[]) => void): Promise<boolean> {
  return sendMessage('pri(metadata.requests)', null, cb);
}

export async function subscribeSigningRequests (cb: (accounts: SigningRequest[]) => void): Promise<boolean> {
  return sendMessage('pri(signing.requests)', null, cb);
}

export async function validateSeed (suri: string, type?: KeypairType): Promise<{ address: string; suri: string }> {
  return sendMessage('pri(seed.validate)', { suri, type });
}

export async function validateSeedV2 (suri: string, types: Array<KeypairType>): Promise<ResponseSeedValidateV2> {
  return sendMessage('pri(seed.validateV2)', { suri, types });
}

export async function validateMetamaskPrivateKeyV2 (suri: string, types: Array<KeypairType>): Promise<ResponsePrivateKeyValidateV2> {
  return sendMessage('pri(privateKey.validateV2)', { suri, types });
}

export async function validateDerivationPath (parentAddress: string, suri: string, parentPassword: string): Promise<ResponseDeriveValidate> {
  return sendMessage('pri(derivation.validate)', { parentAddress, parentPassword, suri });
}

export async function deriveAccount (parentAddress: string, suri: string, parentPassword: string, name: string, password: string, genesisHash: string | null): Promise<boolean> {
  return sendMessage('pri(derivation.create)', { genesisHash, name, parentAddress, parentPassword, password, suri });
}

export async function deriveAccountV2 (parentAddress: string, suri: string, parentPassword: string, name: string, password: string, genesisHash: string | null, isAllowed: boolean): Promise<boolean> {
  return sendMessage('pri(derivation.createV2)', { genesisHash, name, parentAddress, suri, isAllowed });
}

export async function windowOpen (path: AllowedPath): Promise<boolean> {
  return sendMessage('pri(window.open)', path);
}

export async function jsonGetAccountInfo (json: KeyringPair$Json): Promise<ResponseJsonGetAccountInfo> {
  return sendMessage('pri(json.account.info)', json);
}

export async function jsonRestore (file: KeyringPair$Json, password: string, address: string): Promise<void> {
  return sendMessage('pri(json.restore)', { file, password, address });
}

export async function batchRestore (file: KeyringPairs$Json, password: string, address: string): Promise<void> {
  return sendMessage('pri(json.batchRestore)', { file, password, address });
}

export async function jsonRestoreV2 (request: RequestJsonRestoreV2): Promise<void> {
  return sendMessage('pri(json.restoreV2)', request);
}

export async function batchRestoreV2 (file: KeyringPairs$Json, password: string, accountsInfo: ResponseJsonGetAccountInfo[], isAllowed: boolean): Promise<void> {
  return sendMessage('pri(json.batchRestoreV2)', { file, password, accountsInfo, isAllowed });
}

export async function setNotification (notification: string): Promise<boolean> {
  return sendMessage('pri(settings.notification)', notification);
}

export async function getPrice (): Promise<PriceJson> {
  return sendMessage('pri(price.getPrice)', null);
}

export async function subscribePrice (request: RequestSubscribePrice, callback: (priceData: PriceJson) => void): Promise<PriceJson> {
  return sendMessage('pri(price.getSubscription)', request, callback);
}

export async function getBalance (): Promise<BalanceJson> {
  return sendMessage('pri(balance.getBalance)', null);
}

export async function subscribeBalance (request: RequestSubscribeBalance, callback: (balanceData: BalanceJson) => void): Promise<BalanceJson> {
  return sendMessage('pri(balance.getSubscription)', request, callback);
}

export async function getCrowdloan (): Promise<CrowdloanJson> {
  return sendMessage('pri(crowdloan.getCrowdloan)', null);
}

export async function subscribeCrowdloan (request: RequestSubscribeCrowdloan, callback: (crowdloanData: CrowdloanJson) => void): Promise<CrowdloanJson> {
  return sendMessage('pri(crowdloan.getSubscription)', request, callback);
}

// TODO: remove, deprecated
export async function subscribeAssetRegistry (callback: (map: Record<string, _ChainAsset>) => void): Promise<Record<string, _ChainAsset>> {
  return sendMessage('pri(chainService.subscribeAssetRegistry)', null, callback);
}

export async function subscribeHistory (callback: (historyMap: TxHistoryItem[]) => void): Promise<TxHistoryItem[]> {
  return sendMessage('pri(transaction.history.getSubscription)', null, callback);
}

export async function updateTransactionHistory (address: string, networkKey: string, item: TxHistoryItem, callback: (items: TxHistoryItem[]) => void): Promise<boolean> {
  return sendMessage('pri(transaction.history.add)', { address, networkKey, item }, callback);
}

export async function getNft (account: string): Promise<NftJson> {
  // @ts-ignore
  return sendMessage('pri(nft.getNft)', account);
}

export async function subscribeNft (request: RequestSubscribeNft, callback: (nftData: NftJson) => void): Promise<NftJson> {
  return sendMessage('pri(nft.getSubscription)', request, callback);
}

export async function subscribeNftCollection (callback: (data: NftCollection[]) => void): Promise<NftCollection[]> {
  return sendMessage('pri(nftCollection.getSubscription)', null, callback);
}

export async function getStaking (account: string): Promise<StakingJson> {
  // @ts-ignore
  return sendMessage('pri(staking.getStaking)', account);
}

export async function subscribeStaking (request: RequestSubscribeStaking, callback: (stakingData: StakingJson) => void): Promise<StakingJson> {
  return sendMessage('pri(staking.getSubscription)', request, callback);
}

export async function getStakingReward (): Promise<StakingRewardJson> {
  return sendMessage('pri(stakingReward.getStakingReward)');
}

export async function subscribeStakingReward (request: RequestSubscribeStakingReward, callback: (stakingRewardData: StakingRewardJson) => void): Promise<StakingRewardJson> {
  return sendMessage('pri(stakingReward.getSubscription)', request, callback);
}

export async function nftForceUpdate (request: RequestNftForceUpdate): Promise<boolean> {
  return sendMessage('pri(nft.forceUpdate)', request);
}

export async function getNftTransfer (): Promise<NftTransferExtra> {
  return sendMessage('pri(nftTransfer.getNftTransfer)', null);
}

export async function subscribeNftTransfer (callback: (data: NftTransferExtra) => void): Promise<NftTransferExtra> {
  return sendMessage('pri(nftTransfer.getSubscription)', null, callback);
}

export async function setNftTransfer (request: NftTransferExtra): Promise<boolean> {
  return sendMessage('pri(nftTransfer.setNftTransfer)', request);
}

export async function checkTransfer (request: RequestCheckTransfer): Promise<ResponseCheckTransfer> {
  return sendMessage('pri(accounts.checkTransfer)', request);
}

export async function checkCrossChainTransfer (request: RequestCheckCrossChainTransfer): Promise<ResponseCheckCrossChainTransfer> {
  return sendMessage('pri(accounts.checkCrossChainTransfer)', request);
}

export async function makeTransfer (request: RequestTransfer, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(accounts.transfer)', request, callback);
}

export async function makeCrossChainTransfer (request: RequestCrossChainTransfer, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(accounts.crossChainTransfer)', request, callback);
}

export async function evmNftGetTransaction (request: NftTransactionRequest): Promise<EvmNftTransaction> {
  return sendMessage('pri(evmNft.getTransaction)', request);
}

export async function evmNftSubmitTransaction (request: RequestEvmNftSubmitTransaction, callback: (data: NftTransactionResponse) => void): Promise<NftTransactionResponse> {
  return sendMessage('pri(evmNft.submitTransaction)', request, callback);
}

// TODO: remove this
export async function getNetworkMap (): Promise<Record<string, NetworkJson>> {
  return sendMessage('pri(networkMap.getNetworkMap)');
}

// ChainService -------------------------------------------------------------------------------------

export async function subscribeChainInfoMap (callback: (data: Record<string, _ChainInfo>) => void): Promise<Record<string, _ChainInfo>> {
  return sendMessage('pri(chainService.subscribeChainInfoMap)', null, callback);
}

export async function subscribeChainStateMap (callback: (data: Record<string, _ChainState>) => void): Promise<Record<string, _ChainState>> {
  return sendMessage('pri(chainService.subscribeChainStateMap)', null, callback);
}

export async function removeChain (networkKey: string): Promise<boolean> {
  return sendMessage('pri(chainService.removeChain)', networkKey);
}

export async function disableChain (networkKey: string): Promise<DisableNetworkResponse> {
  return sendMessage('pri(chainService.disableChain)', networkKey);
}

export async function enableChain (networkKey: string): Promise<boolean> {
  return sendMessage('pri(chainService.enableChain)', networkKey);
}

export async function enableChains (targetKeys: string[]): Promise<boolean> {
  return sendMessage('pri(chainService.enableChains)', targetKeys);
}

export async function disableChains (targetKeys: string[]): Promise<boolean> {
  return sendMessage('pri(chainService.disableChains)', targetKeys);
}

export async function upsertNetworkMap (data: Record<string, any>): Promise<boolean> {
  return sendMessage('pri(chainService.upsertCustomChain)', data);
}

export async function getSupportedContractTypes (): Promise<string[]> {
  return sendMessage('pri(chainService.getSupportedContractTypes)', null);
}

export async function upsertCustomToken (data: _ChainAsset): Promise<boolean> {
  return sendMessage('pri(chainService.upsertCustomToken)', data);
}

export async function deleteCustomTokens (data: string[]) {
  return sendMessage('pri(chainService.deleteCustomTokens)', data);
}

export async function validateCustomToken (data: _ValidateCustomTokenRequest): Promise<Record<string, any>> {
  return sendMessage('pri(chainService.validateCustomToken)', data);
}

export async function resetDefaultNetwork (): Promise<boolean> {
  return sendMessage('pri(chainService.resetDefaultChains)', null);
}

// -------------------------------------------------------------------------------------

export async function validateNetwork (provider: string, existedChainSlug?: string): Promise<ValidateNetworkResponse> {
  return sendMessage('pri(apiMap.validate)', { provider, existedChainSlug });
}

export async function disableAllNetwork (): Promise<boolean> {
  return sendMessage('pri(networkMap.disableAll)', null);
}

export async function enableAllNetwork (): Promise<boolean> {
  return sendMessage('pri(networkMap.enableAll)', null);
}

export async function subscribeCustomToken (callback: (data: CustomTokenJson) => void): Promise<CustomTokenJson> {
  return sendMessage('pri(customTokenState.getSubscription)', null, callback);
}

export async function transferCheckReferenceCount (request: RequestTransferCheckReferenceCount): Promise<boolean> {
  return sendMessage('pri(transfer.checkReferenceCount)', request);
}

export async function transferCheckSupporting (request: RequestTransferCheckSupporting): Promise<SupportTransferResponse> {
  return sendMessage('pri(transfer.checkSupporting)', request);
}

export async function transferGetExistentialDeposit (request: RequestTransferExistentialDeposit): Promise<string> {
  return sendMessage('pri(transfer.getExistentialDeposit)', request);
}

export async function cancelSubscription (request: string): Promise<boolean> {
  return sendMessage('pri(subscription.cancel)', request);
}

export async function subscribeFreeBalance (request: RequestFreeBalance, callback: (balance: string) => void): Promise<string> {
  return sendMessage('pri(freeBalance.subscribe)', request, callback);
}

export async function substrateNftGetTransaction (request: NftTransactionRequest): Promise<SubstrateNftTransaction> {
  return sendMessage('pri(substrateNft.getTransaction)', request);
}

export async function substrateNftSubmitTransaction (request: RequestSubstrateNftSubmitTransaction, callback: (data: NftTransactionResponse) => void): Promise<NftTransactionResponse> {
  return sendMessage('pri(substrateNft.submitTransaction)', request, callback);
}

export async function recoverDotSamaApi (request: string): Promise<boolean> {
  return sendMessage('pri(networkMap.recoverDotSama)', request);
}

// Sign Qr

export async function accountIsLocked (address: string): Promise<ResponseAccountIsLocked> {
  return sendMessage('pri(account.isLocked)', { address });
}

export async function qrSignSubstrate (request: RequestQrSignSubstrate): Promise<ResponseQrSignSubstrate> {
  return sendMessage('pri(qr.sign.substrate)', request);
}

export async function qrSignEvm (request: RequestQrSignEVM): Promise<ResponseQrSignEVM> {
  return sendMessage('pri(qr.sign.evm)', request);
}

export async function parseSubstrateTransaction (request: RequestParseTransactionSubstrate): Promise<ResponseParseTransactionSubstrate> {
  return sendMessage('pri(qr.transaction.parse.substrate)', request);
}

export async function parseEVMTransaction (data: string): Promise<ResponseQrParseRLP> {
  return sendMessage('pri(qr.transaction.parse.evm)', { data });
}

// External with Qr

export async function makeTransferQr (request: RequestTransferExternal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(accounts.transfer.qr.create)', request, callback);
}

export async function makeCrossChainTransferQr (request: RequestCrossChainTransferExternal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(accounts.cross.transfer.qr.create)', request, callback);
}

export async function makeTransferNftQrSubstrate (request: RequestNftTransferExternalSubstrate, callback: (data: NftTransactionResponse) => void): Promise<NftTransactionResponse> {
  return sendMessage('pri(nft.transfer.qr.create.substrate)', request, callback);
}

export async function makeTransferNftQrEvm (request: RequestNftTransferExternalEVM, callback: (data: NftTransactionResponse) => void): Promise<NftTransactionResponse> {
  return sendMessage('pri(nft.transfer.qr.create.evm)', request, callback);
}

export async function makeBondingQr (request: RequestStakeExternal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(stake.qr.create)', request, callback);
}

export async function makeUnBondingQr (request: RequestUnStakeExternal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(unStake.qr.create)', request, callback);
}

export async function stakeWithdrawQr (request: RequestWithdrawStakeExternal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(withdrawStake.qr.create)', request, callback);
}

export async function claimRewardQr (request: RequestClaimRewardExternal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(claimReward.qr.create)', request, callback);
}

export async function createCompoundQr (request: RequestCreateCompoundStakeExternal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(createCompound.qr.create)', request, callback);
}

export async function cancelCompoundQr (request: RequestCancelCompoundStakeExternal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(cancelCompound.qr.create)', request, callback);
}

// External with Ledger

export async function makeTransferLedger (request: RequestTransferExternal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(accounts.transfer.ledger.create)', request, callback);
}

export async function makeCrossChainTransferLedger (request: RequestCrossChainTransferExternal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(accounts.cross.transfer.ledger.create)', request, callback);
}

export async function makeTransferNftLedgerSubstrate (request: RequestNftTransferExternalSubstrate, callback: (data: NftTransactionResponse) => void): Promise<NftTransactionResponse> {
  return sendMessage('pri(nft.transfer.ledger.create.substrate)', request, callback);
}

export async function makeBondingLedger (request: RequestStakeExternal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(stake.ledger.create)', request, callback);
}

export async function makeUnBondingLedger (request: RequestUnStakeExternal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(unStake.ledger.create)', request, callback);
}

export async function stakeWithdrawLedger (request: RequestWithdrawStakeExternal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(withdrawStake.ledger.create)', request, callback);
}

export async function claimRewardLedger (request: RequestClaimRewardExternal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(claimReward.ledger.create)', request, callback);
}

export async function createCompoundLedger (request: RequestCreateCompoundStakeExternal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(createCompound.ledger.create)', request, callback);
}

export async function cancelCompoundLedger (request: RequestCancelCompoundStakeExternal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(cancelCompound.ledger.create)', request, callback);
}

// External request

export async function rejectExternalRequest (request: RequestRejectExternalRequest): Promise<ResponseRejectExternalRequest> {
  return sendMessage('pri(account.external.reject)', request);
}

export async function resolveExternalRequest (request: RequestResolveExternalRequest): Promise<ResponseResolveExternalRequest> {
  return sendMessage('pri(account.external.resolve)', request);
}

export async function getAccountMeta (request: RequestAccountMeta): Promise<ResponseAccountMeta> {
  return sendMessage('pri(accounts.get.meta)', request);
}

export async function subscribeConfirmations (callback: (data: ConfirmationsQueue) => void): Promise<ConfirmationsQueue> {
  return sendMessage('pri(confirmations.subscribe)', null, callback);
}

export async function completeConfirmation<CT extends ConfirmationType> (type: CT, payload: ConfirmationDefinitions[CT][1]): Promise<boolean> {
  return sendMessage('pri(confirmations.complete)', { [type]: payload });
}

export async function getBondingOptions (networkKey: string, address: string): Promise<BondingOptionInfo> {
  return sendMessage('pri(bonding.getBondingOptions)', { networkKey, address });
}

export async function getChainBondingBasics (networkJsons: NetworkJson[], callback: (data: Record<string, ChainBondingBasics>) => void): Promise<Record<string, ChainBondingBasics>> {
  return sendMessage('pri(bonding.getChainBondingBasics)', networkJsons, callback);
}

export async function submitBonding (request: RequestBondingSubmit, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(bonding.submitTransaction)', request, callback);
}

export async function getBondingTxInfo (bondingSubmitParams: BondingSubmitParams): Promise<BasicTxInfo> {
  return sendMessage('pri(bonding.txInfo)', bondingSubmitParams);
}

export async function getUnbondingTxInfo (unbondingSubmitParams: UnbondingSubmitParams): Promise<BasicTxInfo> {
  return sendMessage('pri(unbonding.txInfo)', unbondingSubmitParams);
}

export async function submitUnbonding (request: RequestUnbondingSubmit, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(unbonding.submitTransaction)', request, callback);
}

export async function subscribeStakeUnlockingInfo (callback: (data: StakeUnlockingJson) => void): Promise<StakeUnlockingJson> {
  return sendMessage('pri(unbonding.subscribeUnlockingInfo)', null, callback);
}

export async function getStakeWithdrawalTxInfo (params: StakeWithdrawalParams): Promise<BasicTxInfo> {
  return sendMessage('pri(unbonding.withdrawalTxInfo)', params);
}

export async function submitStakeWithdrawal (params: RequestStakeWithdrawal, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(unbonding.submitWithdrawal)', params, callback);
}

export async function getStakeClaimRewardTxInfo (params: StakeClaimRewardParams): Promise<BasicTxInfo> {
  return sendMessage('pri(staking.claimRewardTxInfo)', params);
}

export async function submitStakeClaimReward (request: RequestStakeClaimReward, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(staking.submitClaimReward)', request, callback);
}

export async function getStakeDelegationInfo (params: StakeDelegationRequest): Promise<DelegationItem[]> {
  return sendMessage('pri(staking.delegationInfo)', params);
}

export async function parseEVMTransactionInput (request: RequestParseEVMContractInput): Promise<ResponseParseEVMContractInput> {
  return sendMessage('pri(evm.transaction.parse.input)', request);
}

export async function subscribeAuthUrl (callback: (data: AuthUrls) => void): Promise<AuthUrls> {
  return sendMessage('pri(authorize.subscribe)', null, callback);
}

export async function getTuringStakeCompoundTxInfo (request: TuringStakeCompoundParams): Promise<TuringStakeCompoundResp> {
  return sendMessage('pri(staking.turingCompound)', request);
}

export async function submitTuringStakeCompounding (request: RequestTuringStakeCompound, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(staking.submitTuringCompound)', request, callback);
}

export async function checkTuringStakeCompounding (request: CheckExistingTuringCompoundParams): Promise<ExistingTuringCompoundTask> {
  return sendMessage('pri(staking.checkTuringCompoundTask)', request);
}

export async function getTuringCancelStakeCompoundTxInfo (params: TuringCancelStakeCompoundParams): Promise<BasicTxInfo> {
  return sendMessage('pri(staking.turingCancelCompound)', params);
}

export async function submitTuringCancelStakeCompounding (request: RequestTuringCancelStakeCompound, callback: (data: BasicTxResponse) => void): Promise<BasicTxResponse> {
  return sendMessage('pri(staking.submitTuringCancelCompound)', request, callback);
}

export async function wasmNftGetTransaction (request: NftTransactionRequest): Promise<SubstrateNftTransaction> {
  return sendMessage('pri(wasmNft.getTransaction)', request);
}

// Keyring state
export async function keyringStateSubscribe (cb: (value: KeyringState) => void): Promise<KeyringState> {
  return sendMessage('pri(keyring.subscribe)', null, cb);
}

export async function keyringChangeMasterPassword (request: RequestChangeMasterPassword): Promise<ResponseChangeMasterPassword> {
  return sendMessage('pri(keyring.change)', request);
}

export async function keyringMigrateMasterPassword (request: RequestMigratePassword): Promise<ResponseMigratePassword> {
  return sendMessage('pri(keyring.migrate)', request);
}

export async function keyringUnlock (request: RequestUnlockKeyring): Promise<ResponseUnlockKeyring> {
  return sendMessage('pri(keyring.unlock)', request);
}

export async function keyringLock (): Promise<void> {
  return sendMessage('pri(keyring.lock)', null);
}

export async function keyringExportMnemonic (request: RequestKeyringExportMnemonic): Promise<ResponseKeyringExportMnemonic> {
  return sendMessage('pri(keyring.export.mnemonic)', request);
}

/// Derive
export async function validateDerivePathV2 (request: RequestDeriveValidateV2): Promise<ResponseDeriveValidateV2> {
  return sendMessage('pri(derivation.validateV2)', request);
}

export async function getListDeriveAccounts (request: RequestGetDeriveAccounts): Promise<ResponseGetDeriveAccounts> {
  return sendMessage('pri(derivation.getList)', request);
}

export async function deriveMultiple (request: RequestDeriveCreateMultiple): Promise<boolean> {
  return sendMessage('pri(derivation.create.multiple)', request);
}
