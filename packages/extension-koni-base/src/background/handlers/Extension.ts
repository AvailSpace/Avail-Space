// Copyright 2019-2022 @subwallet/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

import Common from '@ethereumjs/common';
import Extension, { SEED_DEFAULT_LENGTH, SEED_LENGTHS } from '@subwallet/extension-base/background/handlers/Extension';
import { AuthUrls } from '@subwallet/extension-base/background/handlers/State';
import { createSubscription, isSubscriptionRunning, unsubscribe } from '@subwallet/extension-base/background/handlers/subscriptions';
import { AccountExternalError, AccountExternalErrorCode, AccountsWithCurrentAddress, ApiProps, BalanceJson, BaseTxError, BasicTxErrorCode, BasicTxInfo, BasicTxResponse, BondingOptionInfo, BondingOptionParams, BondingSubmitParams, ChainBondingBasics, ChainRegistry, CrowdloanJson, CurrentAccountInfo, CustomEvmToken, DelegationItem, DeleteEvmTokenParams, DisableNetworkResponse, EvmNftSubmitTransaction, EvmNftTransaction, EvmNftTransactionRequest, EvmTokenJson, ExternalRequestPromise, ExternalRequestPromiseStatus, NETWORK_ERROR, NetWorkGroup, NetworkJson, NftCollection, NftCollectionJson, NftItem, NftJson, NftTransactionResponse, NftTransferExtra, OptionInputAddress, PriceJson, RequestAccountCreateExternalV2, RequestAccountCreateHardwareV2, RequestAccountCreateSuriV2, RequestAccountExportPrivateKey, RequestAccountMeta, RequestAuthorization, RequestAuthorizationBlock, RequestAuthorizationPerAccount, RequestAuthorizationPerSite, RequestAuthorizeApproveV2, RequestBatchRestoreV2, RequestCheckCrossChainTransfer, RequestCheckTransfer, RequestConfirmationComplete, RequestCrossChainTransfer, RequestCrossChainTransferExternal, RequestDeriveCreateV2, RequestForgetSite, RequestFreeBalance, RequestJsonRestoreV2, RequestNftForceUpdate, RequestNftTransferExternalEVM, RequestNftTransferExternalSubstrate, RequestParseEVMTransactionInput, RequestParseTransactionEVM, RequestQrSignEVM, RequestRejectExternalRequest, RequestResolveExternalRequest, RequestSaveRecentAccount, RequestSeedCreateV2, RequestSeedValidateV2, RequestSettingsType, RequestStakeExternal, RequestTransactionHistoryAdd, RequestTransfer, RequestTransferCheckReferenceCount, RequestTransferCheckSupporting, RequestTransferExistentialDeposit, RequestTransferExternal, RequestUnStakeExternal, RequestWithdrawStakeExternal, ResponseAccountCreateSuriV2, ResponseAccountExportPrivateKey, ResponseAccountMeta, ResponseCheckCrossChainTransfer, ResponseCheckTransfer, ResponseParseEVMTransactionInput, ResponseParseTransactionEVM, ResponsePrivateKeyValidateV2, ResponseQrSignEVM, ResponseRejectExternalRequest, ResponseResolveExternalRequest, ResponseSeedCreateV2, ResponseSeedValidateV2, ResponseTransfer, StakeClaimRewardParams, StakeDelegationRequest, StakeUnlockingJson, StakeWithdrawalParams, StakingJson, StakingRewardJson, SubstrateNftSubmitTransaction, SubstrateNftTransaction, SubstrateNftTransactionRequest, SupportTransferResponse, ThemeTypes, TokenInfo, TransactionHistoryItemType, TransferError, TransferErrorCode, TransferStep, UnbondingSubmitParams, ValidateEvmTokenRequest, ValidateEvmTokenResponse, ValidateNetworkRequest, ValidateNetworkResponse } from '@subwallet/extension-base/background/KoniTypes';
import { AccountJson, AuthorizeRequest, MessageTypes, RequestAccountForget, RequestAccountTie, RequestAuthorizeCancel, RequestAuthorizeReject, RequestCurrentAccountAddress, RequestParseTransactionSubstrate, RequestTypes, ResponseAuthorizeList, ResponseParseTransactionSubstrate, ResponseType } from '@subwallet/extension-base/background/types';
import { getId } from '@subwallet/extension-base/utils/getId';
import { getBondingExtrinsic, getBondingTxInfo, getChainBondingBasics, getClaimRewardExtrinsic, getClaimRewardTxInfo, getDelegationInfo, getUnbondingExtrinsic, getUnbondingTxInfo, getValidatorsInfo, getWithdrawalExtrinsic, getWithdrawalTxInfo } from '@subwallet/extension-koni-base/api/bonding';
import { initApi } from '@subwallet/extension-koni-base/api/dotsama';
import { getFreeBalance, subscribeFreeBalance } from '@subwallet/extension-koni-base/api/dotsama/balance';
import { createStakeLedger, createStakeQr, createUnStakeLedger, createUnStakeQr, createWithdrawStakeLedger, createWithdrawStakeQr } from '@subwallet/extension-koni-base/api/dotsama/external/stake';
import { makeCrossChainTransferLedger, makeCrossChainTransferQr, makeNftTransferLedger, makeNftTransferQr, makeTransferLedger, makeTransferQr } from '@subwallet/extension-koni-base/api/dotsama/external/transfer';
import { parseSubstratePayload } from '@subwallet/extension-koni-base/api/dotsama/parseSubstratePayload';
import { getTokenInfo } from '@subwallet/extension-koni-base/api/dotsama/registry';
import { checkReferenceCount, checkSupportTransfer, estimateFee, getExistentialDeposit, makeTransfer } from '@subwallet/extension-koni-base/api/dotsama/transfer';
import { SUPPORTED_TRANSFER_SUBSTRATE_CHAIN_NAME } from '@subwallet/extension-koni-base/api/nft/config';
import { acalaTransferHandler, getNftTransferExtrinsic, isRecipientSelf, quartzTransferHandler, rmrkTransferHandler, statemineTransferHandler, uniqueTransferHandler, unlockAccount } from '@subwallet/extension-koni-base/api/nft/transfer';
import { parseEVMTransaction, parseTransactionData } from '@subwallet/extension-koni-base/api/web3/parseEVMTransaction';
import { getERC20TransactionObject, getEVMTransactionObject, makeERC20Transfer, makeEVMTransfer } from '@subwallet/extension-koni-base/api/web3/transfer';
import { handleTransferNftQr, makeERC20TransferQr, makeEVMTransferQr } from '@subwallet/extension-koni-base/api/web3/transferQr';
import { ERC721Contract, getERC20Contract, getERC721Contract, initWeb3Api } from '@subwallet/extension-koni-base/api/web3/web3';
import { estimateCrossChainFee, makeCrossChainTransfer } from '@subwallet/extension-koni-base/api/xcm';
import { state } from '@subwallet/extension-koni-base/background/handlers/index';
import { ALL_ACCOUNT_KEY, ALL_GENESIS_HASH } from '@subwallet/extension-koni-base/constants';
import { getCurrentProvider, isValidProvider, reformatAddress } from '@subwallet/extension-koni-base/utils';
import { createTransactionFromRLP, signatureToHex, Transaction as QrTransaction } from '@subwallet/extension-koni-base/utils/eth';
import BigN from 'bignumber.js';
import { Transaction } from 'ethereumjs-tx';
import Web3 from 'web3';
import { SignedTransaction as Web3SignedTransaction, TransactionConfig } from 'web3-core';
import { Contract } from 'web3-eth-contract';

import { createPair } from '@polkadot/keyring';
import { KeyringPair, KeyringPair$Json, KeyringPair$Meta } from '@polkadot/keyring/types';
import { ChainType } from '@polkadot/types/interfaces';
import { keyring } from '@polkadot/ui-keyring';
import { accounts as accountsObservable } from '@polkadot/ui-keyring/observable/accounts';
import { SingleAddress, SubjectInfo } from '@polkadot/ui-keyring/observable/types';
import { assert, BN, hexToU8a, isAscii, isHex, u8aToString } from '@polkadot/util';
import { base64Decode, isEthereumAddress, jsonDecrypt, keyExtractSuri, mnemonicGenerate, mnemonicValidate } from '@polkadot/util-crypto';
import { EncryptedJson, KeypairType, Prefix } from '@polkadot/util-crypto/types';

const ETH_DERIVE_DEFAULT = '/m/44\'/60\'/0\'/0/0';

function getSuri (seed: string, type?: KeypairType): string {
  return type === 'ethereum'
    ? `${seed}${ETH_DERIVE_DEFAULT}`
    : seed;
}

function transformAccounts (accounts: SubjectInfo): AccountJson[] {
  return Object.values(accounts).map(({ json: { address, meta }, type }): AccountJson => ({
    address,
    ...meta,
    type
  }));
}

const ACCOUNT_ALL_JSON: AccountJson = {
  address: ALL_ACCOUNT_KEY,
  name: 'All'
};

export default class KoniExtension extends Extension {
  private cancelSubscriptionMap: Record<string, () => void> = {};

  private cancelSubscription (id: string): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    if (isSubscriptionRunning(id)) {
      unsubscribe(id);
    }

    if (this.cancelSubscriptionMap[id]) {
      this.cancelSubscriptionMap[id]();

      delete this.cancelSubscriptionMap[id];
    }

    return true;
  }

  public decodeAddress = (key: string | Uint8Array, ignoreChecksum?: boolean, ss58Format?: Prefix): Uint8Array => {
    return keyring.decodeAddress(key, ignoreChecksum, ss58Format);
  };

  public encodeAddress = (key: string | Uint8Array, ss58Format?: Prefix): string => {
    return keyring.encodeAddress(key, ss58Format);
  };

  private accountExportPrivateKey ({ address,
    password }: RequestAccountExportPrivateKey): ResponseAccountExportPrivateKey {
    return state.accountExportPrivateKey({ address, password });
  }

  private accountsGetAllWithCurrentAddress (id: string, port: chrome.runtime.Port): boolean {
    const cb = createSubscription<'pri(accounts.subscribeWithCurrentAddress)'>(id, port);

    const subscription = accountsObservable.subject.subscribe((storedAccounts: SubjectInfo): void => {
      const transformedAccounts = transformAccounts(storedAccounts);

      const accounts: AccountJson[] = transformedAccounts && transformedAccounts.length
        ? [
          {
            ...ACCOUNT_ALL_JSON
          },
          ...transformedAccounts
        ]
        : [];

      const accountsWithCurrentAddress: AccountsWithCurrentAddress = {
        accounts
      };

      setTimeout(() => {
        state.getCurrentAccount((accountInfo) => {
          if (accountInfo) {
            accountsWithCurrentAddress.currentAddress = accountInfo.address;

            if (accountInfo.address === ALL_ACCOUNT_KEY) {
              accountsWithCurrentAddress.currentGenesisHash = accountInfo.currentGenesisHash;
            } else {
              const acc = accounts.find((a) => (a.address === accountInfo.address));

              accountsWithCurrentAddress.currentGenesisHash = acc?.genesisHash || ALL_GENESIS_HASH;
            }
          }

          cb(accountsWithCurrentAddress);
        });
      }, 100);
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      subscription.unsubscribe();
    });

    return true;
  }

  private accountsGetAll (id: string, port: chrome.runtime.Port): string {
    const cb = createSubscription<'pri(accounts.subscribeAccountsInputAddress)'>(id, port);
    const subscription = keyring.keyringOption.optionsSubject.subscribe((options): void => {
      const optionsInputAddress: OptionInputAddress = {
        options
      };

      cb(optionsInputAddress);
    });

    this.cancelSubscriptionMap[id] = subscription.unsubscribe;

    port.onDisconnect.addListener((): void => {
      this.cancelSubscription(id);
    });

    return id;
  }

  private saveRecentAccountId ({ accountId }: RequestSaveRecentAccount): SingleAddress {
    return keyring.saveRecent(accountId);
  }

  private triggerAccountsSubscription (): boolean {
    const accountsSubject = accountsObservable.subject;

    accountsSubject.next(accountsSubject.getValue());

    return true;
  }

  private _getAuthListV2 (): Promise<AuthUrls> {
    return new Promise<AuthUrls>((resolve, reject) => {
      state.getAuthorize((rs: AuthUrls) => {
        const accounts = accountsObservable.subject.getValue();
        const addressList = Object.keys(accounts);
        const urlList = Object.keys(rs);

        if (Object.keys(rs[urlList[0]].isAllowedMap).toString() !== addressList.toString()) {
          urlList.forEach((url) => {
            addressList.forEach((address) => {
              if (!Object.keys(rs[url].isAllowedMap).includes(address)) {
                rs[url].isAllowedMap[address] = false;
              }
            });

            Object.keys(rs[url].isAllowedMap).forEach((address) => {
              if (!addressList.includes(address)) {
                delete rs[url].isAllowedMap[address];
              }
            });
          });

          state.setAuthorize(rs);
        }

        resolve(rs);
      });
    });
  }

  private authorizeSubscribeV2 (id: string, port: chrome.runtime.Port): boolean {
    const cb = createSubscription<'pri(authorize.requestsV2)'>(id, port);
    const subscription = state.authSubjectV2.subscribe((requests: AuthorizeRequest[]): void =>
      cb(requests)
    );

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      subscription.unsubscribe();
    });

    return true;
  }

  private async getAuthListV2 (): Promise<ResponseAuthorizeList> {
    const authList = await this._getAuthListV2();

    return { list: authList };
  }

  private authorizeApproveV2 ({ accounts, id }: RequestAuthorizeApproveV2): boolean {
    const queued = state.getAuthRequestV2(id);

    assert(queued, 'Unable to find request');

    const { resolve } = queued;

    resolve({ accounts, result: true });

    return true;
  }

  private authorizeRejectV2 ({ id }: RequestAuthorizeReject): boolean {
    const queued = state.getAuthRequestV2(id);

    assert(queued, 'Unable to find request');

    const { reject } = queued;

    reject(new Error('Rejected'));

    return true;
  }

  private authorizeCancelV2 ({ id }: RequestAuthorizeCancel): boolean {
    const queued = state.getAuthRequestV2(id);

    assert(queued, 'Unable to find request');

    const { reject } = queued;

    // Reject without error meaning cancel
    reject(new Error('Cancelled'));

    return true;
  }

  private _forgetSite (url: string, callBack?: (value: AuthUrls) => void) {
    state.getAuthorize((value) => {
      assert(value, 'The source is not known');

      delete value[url];

      state.setAuthorize(value, () => {
        callBack && callBack(value);
      });
    });
  }

  private forgetSite (data: RequestForgetSite, id: string, port: chrome.runtime.Port): boolean {
    const cb = createSubscription<'pri(authorize.forgetSite)'>(id, port);

    this._forgetSite(data.url, (items) => {
      cb(items);
    });

    return true;
  }

  private _forgetAllSite (callBack?: (value: AuthUrls) => void) {
    state.getAuthorize((value) => {
      assert(value, 'The source is not known');

      value = {};

      state.setAuthorize(value, () => {
        callBack && callBack(value);
      });
    });
  }

  private forgetAllSite (id: string, port: chrome.runtime.Port): boolean {
    const cb = createSubscription<'pri(authorize.forgetAllSite)'>(id, port);

    this._forgetAllSite((items) => {
      cb(items);
    });

    return true;
  }

  private _changeAuthorizationAll (connectValue: boolean, callBack?: (value: AuthUrls) => void) {
    state.getAuthorize((value) => {
      assert(value, 'The source is not known');

      Object.keys(value).forEach((url) => {
        // eslint-disable-next-line no-return-assign
        Object.keys(value[url].isAllowedMap).forEach((address) => value[url].isAllowedMap[address] = connectValue);
      });
      state.setAuthorize(value, () => {
        callBack && callBack(value);
      });
    });
  }

  private changeAuthorizationAll (data: RequestAuthorization, id: string, port: chrome.runtime.Port): boolean {
    const cb = createSubscription<'pri(authorize.changeSite)'>(id, port);

    this._changeAuthorizationAll(data.connectValue, (items) => {
      cb(items);
    });

    return true;
  }

  private _changeAuthorization (url: string, connectValue: boolean, callBack?: (value: AuthUrls) => void) {
    state.getAuthorize((value) => {
      assert(value[url], 'The source is not known');

      // eslint-disable-next-line no-return-assign
      Object.keys(value[url].isAllowedMap).forEach((address) => value[url].isAllowedMap[address] = connectValue);
      state.setAuthorize(value, () => {
        callBack && callBack(value);
      });
    });
  }

  public toggleAuthorization2 (url: string): Promise<ResponseAuthorizeList> {
    return new Promise((resolve) => {
      state.getAuthorize((value) => {
        assert(value[url], 'The source is not known');

        value[url].isAllowed = !value[url].isAllowed;

        state.setAuthorize(value, () => {
          resolve({ list: value });
        });
      });
    });
  }

  private changeAuthorization (data: RequestAuthorization, id: string, port: chrome.runtime.Port): boolean {
    const cb = createSubscription<'pri(authorize.changeSite)'>(id, port);

    this._changeAuthorization(data.url, data.connectValue, (items) => {
      cb(items);
    });

    return true;
  }

  private _changeAuthorizationPerAcc (address: string, connectValue: boolean, url: string, callBack?: (value: AuthUrls) => void) {
    state.getAuthorize((value) => {
      assert(value, 'The source is not known');

      value[url].isAllowedMap[address] = connectValue;

      console.log('Devbu: ', value);

      state.setAuthorize(value, () => {
        callBack && callBack(value);
      });
    });
  }

  private _changeAuthorizationBlock (connectValue: boolean, id: string) {
    state.getAuthorize((value) => {
      assert(value, 'The source is not known');

      value[id].isAllowed = connectValue;

      console.log('Devbu: ', value);

      state.setAuthorize(value);
    });
  }

  private _changeAuthorizationPerSite (values: Record<string, boolean>, id: string) {
    state.getAuthorize((value) => {
      assert(value, 'The source is not known');

      value[id].isAllowedMap = values;

      console.log('Devbu: ', value);

      state.setAuthorize(value);
    });
  }

  private changeAuthorizationPerAcc (data: RequestAuthorizationPerAccount, id: string, port: chrome.runtime.Port): boolean {
    const cb = createSubscription<'pri(authorize.changeSitePerAccount)'>(id, port);

    this._changeAuthorizationPerAcc(data.address, data.connectValue, data.url, (items) => {
      cb(items);
    });

    return true;
  }

  private changeAuthorizationPerSite (data: RequestAuthorizationPerSite): boolean {
    this._changeAuthorizationPerSite(data.values, data.id);

    return true;
  }

  private changeAuthorizationBlock (data: RequestAuthorizationBlock): boolean {
    this._changeAuthorizationBlock(data.connectedValue, data.id);

    return true;
  }

  private getSettings (): Promise<RequestSettingsType> {
    return new Promise<RequestSettingsType>((resolve, reject) => {
      state.getSettings((rs) => {
        resolve(rs);
      });
    });
  }

  private toggleBalancesVisibility (id: string, port: chrome.runtime.Port) {
    const cb = createSubscription<'pri(settings.changeBalancesVisibility)'>(id, port);

    state.getSettings((value) => {
      const updateValue = {
        ...value,
        isShowBalance: !value.isShowBalance
      };

      state.setSettings(updateValue, () => {
        // eslint-disable-next-line node/no-callback-literal
        cb(updateValue);
      });
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return true;
  }

  private saveAccountAllLogo (data: string, id: string, port: chrome.runtime.Port) {
    const cb = createSubscription<'pri(settings.saveAccountAllLogo)'>(id, port);

    state.getSettings((value) => {
      const updateValue = {
        ...value,
        accountAllLogo: data
      };

      state.setSettings(updateValue, () => {
        // eslint-disable-next-line node/no-callback-literal
        cb(updateValue);
      });
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return true;
  }

  private saveTheme (data: ThemeTypes, id: string, port: chrome.runtime.Port) {
    const cb = createSubscription<'pri(settings.saveTheme)'>(id, port);

    state.setTheme(data, cb);

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return true;
  }

  private async subscribeSettings (id: string, port: chrome.runtime.Port) {
    const cb = createSubscription<'pri(settings.subscribe)'>(id, port);

    const balancesVisibilitySubscription = state.subscribeSettingsSubject().subscribe({
      next: (rs) => {
        cb(rs);
      }
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      balancesVisibilitySubscription.unsubscribe();
    });

    return await this.getSettings();
  }

  private async subscribeAuthUrls (id: string, port: chrome.runtime.Port): Promise<AuthUrls> {
    const cb = createSubscription<'pri(authorize.subscribe)'>(id, port);

    const authorizeUrlSubscription = state.subscribeAuthorizeUrlSubject().subscribe({
      next: (rs) => {
        cb(rs);
      }
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      authorizeUrlSubscription.unsubscribe();
    });

    return await state.getAuthList();
  }

  private _saveCurrentAccountAddress (address: string, callback?: (data: CurrentAccountInfo) => void) {
    state.getCurrentAccount((accountInfo) => {
      if (!accountInfo) {
        accountInfo = {
          address,
          currentGenesisHash: ALL_GENESIS_HASH,
          allGenesisHash: ALL_GENESIS_HASH || undefined
        };
      } else {
        accountInfo.address = address;

        if (address !== ALL_ACCOUNT_KEY) {
          const currentKeyPair = keyring.getAccount(address);

          accountInfo.currentGenesisHash = currentKeyPair?.meta.genesisHash as string || ALL_GENESIS_HASH;
        } else {
          accountInfo.currentGenesisHash = accountInfo.allGenesisHash || ALL_GENESIS_HASH;
        }
      }

      state.setCurrentAccount(accountInfo, () => {
        callback && callback(accountInfo);
      });
    });
  }

  private saveCurrentAccountAddress (data: RequestCurrentAccountAddress, id: string, port: chrome.runtime.Port): boolean {
    const cb = createSubscription<'pri(currentAccount.saveAddress)'>(id, port);

    this._saveCurrentAccountAddress(data.address, cb);

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return true;
  }

  private getPrice (): Promise<PriceJson> {
    return new Promise<PriceJson>((resolve, reject) => {
      state.getPrice((rs: PriceJson) => {
        resolve(rs);
      });
    });
  }

  private subscribePrice (id: string, port: chrome.runtime.Port): Promise<PriceJson> {
    const cb = createSubscription<'pri(price.getSubscription)'>(id, port);

    const priceSubscription = state.subscribePrice().subscribe({
      next: (rs) => {
        cb(rs);
      }
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      priceSubscription.unsubscribe();
    });

    return this.getPrice();
  }

  private getBalance (reset?: boolean): BalanceJson {
    return state.getBalance(reset);
  }

  private subscribeBalance (id: string, port: chrome.runtime.Port): BalanceJson {
    const cb = createSubscription<'pri(balance.getSubscription)'>(id, port);

    const balanceSubscription = state.subscribeBalance().subscribe({
      next: (rs) => {
        cb(rs);
      }
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      balanceSubscription.unsubscribe();
    });

    return this.getBalance(true);
  }

  private getCrowdloan (reset?: boolean): CrowdloanJson {
    return state.getCrowdloan(reset);
  }

  private subscribeCrowdloan (id: string, port: chrome.runtime.Port): CrowdloanJson {
    const cb = createSubscription<'pri(crowdloan.getSubscription)'>(id, port);

    const balanceSubscription = state.subscribeCrowdloan().subscribe({
      next: (rs) => {
        cb(rs);
      }
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      balanceSubscription.unsubscribe();
    });

    return this.getCrowdloan(true);
  }

  private getChainRegistryMap (): Record<string, ChainRegistry> {
    return state.getChainRegistryMap();
  }

  private subscribeChainRegistry (id: string, port: chrome.runtime.Port): Record<string, ChainRegistry> {
    const cb = createSubscription<'pri(chainRegistry.getSubscription)'>(id, port);

    const subscription = state.subscribeChainRegistryMap().subscribe({
      next: (rs) => {
        cb(rs);
      }
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      subscription.unsubscribe();
    });

    return this.getChainRegistryMap();
  }

  private validatePassword (json: KeyringPair$Json, password: string): boolean {
    const cryptoType = Array.isArray(json.encoding.content) ? json.encoding.content[1] : 'ed25519';
    const encType = Array.isArray(json.encoding.type) ? json.encoding.type : [json.encoding.type];
    const pair = createPair(
      { toSS58: this.encodeAddress, type: cryptoType as KeypairType },
      { publicKey: this.decodeAddress(json.address, true) },
      json.meta,
      isHex(json.encoded) ? hexToU8a(json.encoded) : base64Decode(json.encoded),
      encType
    );

    // unlock then lock (locking cleans secretKey, so needs to be last)
    try {
      pair.decodePkcs8(password);
      pair.lock();

      return true;
    } catch (e) {
      console.error(e);

      return false;
    }
  }

  private validatedAccountsPassword (json: EncryptedJson, password: string): boolean {
    try {
      u8aToString(jsonDecrypt(json, password));

      return true;
    } catch (e) {
      return false;
    }
  }

  private _addAddressToAuthList (address: string, isAllowed: boolean): void {
    state.getAuthorize((value) => {
      if (value && Object.keys(value).length) {
        Object.keys(value).forEach((url) => {
          value[url].isAllowedMap[address] = isAllowed;
        });

        state.setAuthorize(value);
      }
    });
  }

  private _addAddressesToAuthList (addresses: string[], isAllowed: boolean): void {
    state.getAuthorize((value) => {
      if (value && Object.keys(value).length) {
        Object.keys(value).forEach((url) => {
          addresses.forEach((address) => {
            value[url].isAllowedMap[address] = isAllowed;
          });
        });/**/

        state.setAuthorize(value);
      }
    });
  }

  private async accountsCreateSuriV2 ({ genesisHash,
    isAllowed,
    name,
    password,
    suri: _suri,
    types }: RequestAccountCreateSuriV2): Promise<ResponseAccountCreateSuriV2> {
    const addressDict = {} as Record<KeypairType, string>;
    let changedAccount = false;

    const currentAccount = await new Promise<CurrentAccountInfo>((resolve) => {
      state.getCurrentAccount(resolve);
    });
    const allGenesisHash = currentAccount?.allGenesisHash || undefined;

    types?.forEach((type) => {
      const suri = getSuri(_suri, type);
      const address = keyring.createFromUri(suri, {}, type).address;

      addressDict[type] = address;
      const newAccountName = type === 'ethereum' ? `${name} - EVM` : name;

      keyring.addUri(suri, password, { genesisHash, name: newAccountName }, type);
      this._addAddressToAuthList(address, isAllowed);

      if (!changedAccount) {
        if (types.length === 1) {
          state.setCurrentAccount({ address, currentGenesisHash: genesisHash || null, allGenesisHash });
        } else {
          state.setCurrentAccount({ address: ALL_ACCOUNT_KEY, currentGenesisHash: allGenesisHash || null, allGenesisHash });
        }

        changedAccount = true;
      }
    });

    await new Promise<void>((resolve) => {
      state.addAccountRef(Object.values(addressDict), () => {
        resolve();
      });
    });

    return addressDict;
  }

  private async accountsForgetOverride ({ address }: RequestAccountForget): Promise<boolean> {
    keyring.forgetAccount(address);
    await new Promise<void>((resolve) => {
      state.removeAccountRef(address, () => {
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      state.getAuthorize((value) => {
        if (value && Object.keys(value).length) {
          Object.keys(value).forEach((url) => {
            delete value[url].isAllowedMap[address];
          });

          state.setAuthorize(value, resolve);
        } else {
          resolve();
        }
      });
    });

    // Set current account to all account
    await new Promise<void>((resolve) => {
      state.getCurrentAccount(({ allGenesisHash }) => {
        state.setCurrentAccount({ currentGenesisHash: allGenesisHash || null, address: ALL_ACCOUNT_KEY }, resolve);
      });
    });

    return true;
  }

  private seedCreateV2 ({ length = SEED_DEFAULT_LENGTH, seed: _seed, types }: RequestSeedCreateV2): ResponseSeedCreateV2 {
    const seed = _seed || mnemonicGenerate(length);
    const rs = { seed: seed, addressMap: {} } as ResponseSeedCreateV2;

    types?.forEach((type) => {
      rs.addressMap[type] = keyring.createFromUri(getSuri(seed, type), {}, type).address;
    });

    return rs;
  }

  private seedValidateV2 ({ suri, types }: RequestSeedValidateV2): ResponseSeedValidateV2 {
    const { phrase } = keyExtractSuri(suri);

    if (isHex(phrase)) {
      assert(isHex(phrase, 256), 'Hex seed needs to be 256-bits');
    } else {
      // sadly isHex detects as string, so we need a cast here
      assert(SEED_LENGTHS.includes((phrase).split(' ').length), `Mnemonic needs to contain ${SEED_LENGTHS.join(', ')} words`);
      assert(mnemonicValidate(phrase), 'Not a valid mnemonic seed');
    }

    const rs = { seed: suri, addressMap: {} } as ResponseSeedValidateV2;

    types && types.forEach((type) => {
      rs.addressMap[type] = keyring.createFromUri(getSuri(suri, type), {}, type).address;
    });

    return rs;
  }

  private _checkValidatePrivateKey ({ suri,
    types }: RequestSeedValidateV2, autoAddPrefix = false): ResponsePrivateKeyValidateV2 {
    const { phrase } = keyExtractSuri(suri);
    const rs = { autoAddPrefix: autoAddPrefix, addressMap: {} } as ResponsePrivateKeyValidateV2;

    types && types.forEach((type) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      rs.addressMap[type] = '';
    });

    if (isHex(phrase) && isHex(phrase, 256)) {
      types && types.forEach((type) => {
        rs.addressMap[type] = keyring.createFromUri(getSuri(suri, type), {}, type).address;
      });
    } else {
      rs.autoAddPrefix = false;
      assert(false, 'Not valid private key');
    }

    return rs;
  }

  private metamaskPrivateKeyValidateV2 ({ suri, types }: RequestSeedValidateV2): ResponsePrivateKeyValidateV2 {
    const isValidSuri = suri.startsWith('0x');

    if (isValidSuri) {
      return this._checkValidatePrivateKey({ suri, types });
    } else {
      return this._checkValidatePrivateKey({ suri: `0x${suri}`, types }, true);
    }
  }

  private deriveV2 (parentAddress: string, suri: string, password: string, metadata: KeyringPair$Meta): KeyringPair {
    const parentPair = keyring.getPair(parentAddress);

    try {
      parentPair.decodePkcs8(password);
    } catch (e) {
      throw new Error('invalid password');
    }

    try {
      return parentPair.derive(suri, metadata);
    } catch (err) {
      throw new Error(`"${suri}" is not a valid derivation path`);
    }
  }

  private derivationCreateV2 ({ genesisHash,
    isAllowed,
    name,
    parentAddress,
    parentPassword,
    password,
    suri }: RequestDeriveCreateV2): boolean {
    const childPair = this.deriveV2(parentAddress, suri, parentPassword, {
      genesisHash,
      name,
      parentAddress,
      suri
    });

    const address = childPair.address;

    this._saveCurrentAccountAddress(address, () => {
      keyring.addPair(childPair, password);
      this._addAddressToAuthList(address, isAllowed);
    });

    return true;
  }

  private jsonRestoreV2 ({ address, file, isAllowed, password }: RequestJsonRestoreV2): void {
    const isPasswordValidated = this.validatePassword(file, password);

    if (isPasswordValidated) {
      try {
        this._saveCurrentAccountAddress(address, () => {
          keyring.restoreAccount(file, password);
          this._addAddressToAuthList(address, isAllowed);
        });
      } catch (error) {
        throw new Error((error as Error).message);
      }
    } else {
      throw new Error('Unable to decode using the supplied passphrase');
    }
  }

  private batchRestoreV2 ({ accountsInfo, file, isAllowed, password }: RequestBatchRestoreV2): void {
    const addressList: string[] = accountsInfo.map((acc) => acc.address);
    const isPasswordValidated = this.validatedAccountsPassword(file, password);

    if (isPasswordValidated) {
      try {
        this._saveCurrentAccountAddress(addressList[0], () => {
          keyring.restoreAccounts(file, password);
          this._addAddressesToAuthList(addressList, isAllowed);
        });
      } catch (error) {
        throw new Error((error as Error).message);
      }
    } else {
      throw new Error('Unable to decode using the supplied passphrase');
    }
  }

  private getNftTransfer (): Promise<NftTransferExtra> {
    return new Promise<NftTransferExtra>((resolve, reject) => {
      state.getNftTransferSubscription((rs: NftTransferExtra) => {
        resolve(rs);
      });
    });
  }

  private async subscribeNftTransfer (id: string, port: chrome.runtime.Port): Promise<NftTransferExtra> {
    const cb = createSubscription<'pri(nftTransfer.getSubscription)'>(id, port);
    const nftTransferSubscription = state.subscribeNftTransfer().subscribe({
      next: (rs) => {
        cb(rs);
      }
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      nftTransferSubscription.unsubscribe();
    });

    return this.getNftTransfer();
  }

  private getNftCollection (): Promise<NftCollectionJson> {
    return new Promise<NftCollectionJson>((resolve) => {
      state.getNftCollectionSubscription((rs: NftCollectionJson) => {
        resolve(rs);
      });
    });
  }

  private subscribeNftCollection (id: string, port: chrome.runtime.Port): Promise<NftCollectionJson | null> {
    const cb = createSubscription<'pri(nftCollection.getSubscription)'>(id, port);
    const nftCollectionSubscription = state.subscribeNftCollection().subscribe({
      next: (rs) => {
        cb(rs);
      }
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      nftCollectionSubscription.unsubscribe();
    });

    return this.getNftCollection();
  }

  private getNft (): Promise<NftJson> {
    return new Promise<NftJson>((resolve) => {
      state.getNftSubscription((rs: NftJson) => {
        resolve(rs);
      });
    });
  }

  private async subscribeNft (id: string, port: chrome.runtime.Port): Promise<NftJson | null> {
    const cb = createSubscription<'pri(nft.getSubscription)'>(id, port);
    const nftSubscription = state.subscribeNft().subscribe({
      next: (rs) => {
        cb(rs);
      }
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      nftSubscription.unsubscribe();
    });

    return this.getNft();
  }

  private getStakingReward (): Promise<StakingRewardJson> {
    return new Promise<StakingRewardJson>((resolve, reject) => {
      state.getStakingReward((rs: StakingRewardJson) => {
        resolve(rs);
      });
    });
  }

  private subscribeStakingReward (id: string, port: chrome.runtime.Port): Promise<StakingRewardJson | null> {
    const cb = createSubscription<'pri(stakingReward.getSubscription)'>(id, port);
    const stakingRewardSubscription = state.subscribeStakingReward().subscribe({
      next: (rs) => {
        cb(rs);
      }
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      stakingRewardSubscription.unsubscribe();
    });

    return this.getStakingReward();
  }

  private getStaking (reset?: boolean): StakingJson {
    return state.getStaking(reset);
  }

  private subscribeStaking (id: string, port: chrome.runtime.Port): StakingJson {
    const cb = createSubscription<'pri(staking.getSubscription)'>(id, port);
    const stakingSubscription = state.subscribeStaking().subscribe({
      next: (rs) => {
        cb(rs);
      }
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      stakingSubscription.unsubscribe();
    });

    return this.getStaking(true);
  }

  private subscribeHistory (id: string, port: chrome.runtime.Port): Record<string, TransactionHistoryItemType[]> {
    const cb = createSubscription<'pri(transaction.history.getSubscription)'>(id, port);

    const historySubscription = state.subscribeHistory().subscribe({
      next: (rs) => {
        cb(rs);
      }
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      historySubscription.unsubscribe();
    });

    return state.getHistoryMap();
  }

  private updateTransactionHistory ({ address,
    item,
    networkKey }: RequestTransactionHistoryAdd, id: string, port: chrome.runtime.Port): boolean {
    const cb = createSubscription<'pri(transaction.history.add)'>(id, port);

    state.setTransactionHistory(address, networkKey, item, (items) => {
      cb(items);
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return true;
  }

  private setNftTransfer (request: NftTransferExtra): boolean {
    state.setNftTransfer(request);

    return true;
  }

  private forceUpdateNftState (request: RequestNftForceUpdate): boolean {
    let selectedNftCollection: NftCollection = { collectionId: '' };
    const nftJson = state.getNft();
    const nftCollectionJson = state.getNftCollection();
    const filteredCollections: NftCollection[] = [];
    const filteredItems: NftItem[] = [];
    const remainedItems: NftItem[] = [];
    let itemCount = 0; // count item left in collection

    for (const collection of nftCollectionJson.nftCollectionList) {
      if (collection.chain === request.chain && collection.collectionId === request.collectionId) {
        selectedNftCollection = collection;
        break;
      }
    }

    if (!request.isSendingSelf) {
      for (const item of nftJson.nftList) {
        if (item.chain === request.chain && item.collectionId === request.collectionId) {
          if (item.id !== request.nft.id) {
            itemCount += 1;
            filteredItems.push(item);
            remainedItems.push(item);
          }
        } else {
          filteredItems.push(item);
        }
      }

      state.setNft(request.senderAddress, {
        nftList: filteredItems
      } as NftJson);

      if (itemCount <= 0) {
        for (const collection of nftCollectionJson.nftCollectionList) {
          if (collection.chain !== request.chain || collection.collectionId !== request.collectionId) {
            filteredCollections.push(collection);
          }
        }

        state.setNftCollection(request.senderAddress, {
          ready: true,
          nftCollectionList: filteredCollections
        } as NftCollectionJson);
      }

      this.isInWalletAccount(request.recipientAddress).then((res) => {
        if (res) {
          state.updateNftData(request.recipientAddress, request.nft);
          state.updateNftCollection(request.recipientAddress, selectedNftCollection);
        } else {
          state.removeNftFromMasterStore(request.nft);
        }
      }).catch((err) => console.warn(err));
    } else {
      for (const item of nftJson.nftList) {
        if (item.chain === request.chain && item.collectionId === request.collectionId) {
          remainedItems.push(item);
        }
      }
    }

    state.setNftTransfer({
      cronUpdate: false,
      forceUpdate: true,
      selectedNftCollection,
      nftItems: remainedItems
    });

    return true;
  }

  private async validateTransfer (networkKey: string, token: string | undefined, from: string, to: string, password: string | undefined, value: string | undefined, transferAll: boolean | undefined): Promise<[Array<TransferError>, KeyringPair | undefined, BN | undefined, TokenInfo | undefined]> {
    const dotSamaApiMap = state.getDotSamaApiMap();
    const errors = [] as Array<TransferError>;
    let keypair: KeyringPair | undefined;
    let transferValue;

    if (!transferAll) {
      try {
        if (value === undefined) {
          errors.push({
            code: TransferErrorCode.INVALID_VALUE,
            message: 'Require transfer value'
          });
        }

        if (value) {
          transferValue = new BN(value);
        }
      } catch (e) {
        errors.push({
          code: TransferErrorCode.INVALID_VALUE,
          // @ts-ignore
          message: String(e.message)
        });
      }
    }

    try {
      keypair = keyring.getPair(from);

      if (password) {
        keypair.unlock(password);
      }
    } catch (e) {
      errors.push({
        code: TransferErrorCode.KEYRING_ERROR,
        // @ts-ignore
        message: String(e.message)
      });
    }

    let tokenInfo: TokenInfo | undefined;

    if (token) {
      tokenInfo = await getTokenInfo(networkKey, dotSamaApiMap[networkKey].api, token);

      if (!tokenInfo) {
        errors.push({
          code: TransferErrorCode.INVALID_TOKEN,
          message: 'Not found token from registry'
        });
      }

      if (isEthereumAddress(from) && isEthereumAddress(to) && !tokenInfo?.isMainToken && !(tokenInfo?.erc20Address)) {
        errors.push({
          code: TransferErrorCode.INVALID_TOKEN,
          message: 'Not found ERC20 address for this token'
        });
      }
    }

    return [errors, keypair, transferValue, tokenInfo];
  }

  private async checkTransfer ({ from,
    networkKey,
    to,
    token,
    transferAll,
    value }: RequestCheckTransfer): Promise<ResponseCheckTransfer> {
    const [errors, fromKeyPair, valueNumber, tokenInfo] = await this.validateTransfer(networkKey, token, from, to, undefined, value, transferAll);
    const dotSamaApiMap = state.getDotSamaApiMap();
    const web3ApiMap = state.getApiMap().web3;

    let fee = '0';
    let feeSymbol;
    let fromAccountFree = '0';
    let toAccountFree = '0';

    if (isEthereumAddress(from) && isEthereumAddress(to)) {
      // @ts-ignore
      [fromAccountFree, toAccountFree] = await Promise.all([
        getFreeBalance(networkKey, from, dotSamaApiMap, web3ApiMap, token),
        getFreeBalance(networkKey, to, dotSamaApiMap, web3ApiMap, token)
      ]);
      const txVal: string = transferAll ? fromAccountFree : (value || '0');

      // Estimate with EVM API
      if (tokenInfo && !tokenInfo.isMainToken && tokenInfo.erc20Address) {
        [, , fee] = await getERC20TransactionObject(tokenInfo.erc20Address, networkKey, from, to, txVal, !!transferAll, web3ApiMap);
      } else {
        [, , fee] = await getEVMTransactionObject(networkKey, to, txVal, !!transferAll, web3ApiMap);
      }
    } else {
      // Estimate with DotSama API
      [[fee, feeSymbol], fromAccountFree, toAccountFree] = await Promise.all(
        [
          estimateFee(networkKey, fromKeyPair, to, value, !!transferAll, dotSamaApiMap, tokenInfo),
          getFreeBalance(networkKey, from, dotSamaApiMap, web3ApiMap, token),
          getFreeBalance(networkKey, to, dotSamaApiMap, web3ApiMap, token)
        ]
      );
    }

    console.log('fee', fee);

    const fromAccountFreeNumber = new BN(fromAccountFree);
    const feeNumber = fee ? new BN(fee) : undefined;

    if (!transferAll && value && feeNumber && valueNumber) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      if (fromAccountFreeNumber.lt(feeNumber.add(valueNumber))) {
        errors.push({
          code: TransferErrorCode.NOT_ENOUGH_VALUE,
          message: 'Not enough balance free to make transfer'
        });
      }
    }

    return {
      errors,
      fromAccountFree: fromAccountFree,
      toAccountFree: toAccountFree,
      estimateFee: fee,
      feeSymbol
    } as ResponseCheckTransfer;
  }

  private async validateCrossChainTransfer (
    originNetworkKey: string,
    destinationNetworkKey: string,
    token: string,
    from: string, to: string,
    password: string | undefined,
    value: string): Promise<[Array<TransferError>, KeyringPair | undefined, BN | undefined, TokenInfo | undefined]> {
    const dotSamaApiMap = state.getDotSamaApiMap();
    const errors = [] as Array<TransferError>;
    let keypair: KeyringPair | undefined;
    const transferValue = new BN(value);

    try {
      keypair = keyring.getPair(from);

      if (password) {
        keypair.unlock(password);
      }
    } catch (e) {
      errors.push({
        code: TransferErrorCode.KEYRING_ERROR,
        // @ts-ignore
        message: String(e.message)
      });
    }

    const tokenInfo: TokenInfo | undefined = await getTokenInfo(originNetworkKey, dotSamaApiMap[originNetworkKey].api, token);

    if (!tokenInfo) {
      errors.push({
        code: TransferErrorCode.INVALID_TOKEN,
        message: 'Not found token from registry'
      });
    }

    return [errors, keypair, transferValue, tokenInfo];
  }

  private async checkCrossChainTransfer ({ destinationNetworkKey, from, originNetworkKey, to, token, value }: RequestCheckCrossChainTransfer): Promise<ResponseCheckCrossChainTransfer> {
    const [errors, fromKeyPair, valueNumber, tokenInfo] = await this.validateCrossChainTransfer(originNetworkKey, destinationNetworkKey, token, from, to, undefined, value);
    const dotSamaApiMap = state.getDotSamaApiMap();
    const web3ApiMap = state.getApiMap().web3;
    let fee = '0';
    let feeString;
    let fromAccountFree = '0';

    if (tokenInfo && fromKeyPair) {
      [[fee, feeString], fromAccountFree] = await Promise.all([
        estimateCrossChainFee(
          originNetworkKey,
          destinationNetworkKey,
          to,
          fromKeyPair,
          value,
          dotSamaApiMap,
          tokenInfo,
          state.getNetworkMap()
        ),
        getFreeBalance(originNetworkKey, from, dotSamaApiMap, web3ApiMap)
      ]);
    }

    const fromAccountFreeNumber = new BN(fromAccountFree);
    const feeNumber = fee ? new BN(fee) : undefined;

    if (value && feeNumber && valueNumber) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      if (fromAccountFreeNumber.lt(feeNumber.add(valueNumber))) {
        errors.push({
          code: TransferErrorCode.NOT_ENOUGH_VALUE,
          message: 'Not enough balance free to make transfer'
        });
      }
    }

    return {
      errors,
      feeString,
      estimatedFee: fee,
      feeSymbol: state.getNetworkMapByKey(originNetworkKey).nativeToken as string
    };
  }

  private makeTransferCallback (
    address: string,
    recipientAddress: string,
    networkKey: string,
    token: string | undefined,
    portCallback: (res: ResponseTransfer) => void): (res: ResponseTransfer) => void {
    return (res: ResponseTransfer) => {
      // !res.isFinalized to prevent duplicate action
      if (!res.isFinalized && res.txResult && res.extrinsicHash) {
        const transaction = {
          time: Date.now(),
          networkKey,
          change: res.txResult.change,
          changeSymbol: res.txResult.changeSymbol || token,
          fee: res.txResult.fee,
          feeSymbol: res.txResult.feeSymbol,
          isSuccess: res.step.valueOf() === TransferStep.SUCCESS.valueOf(),
          extrinsicHash: res.extrinsicHash
        } as TransactionHistoryItemType;

        state.setTransactionHistory(address, networkKey, { ...transaction, action: 'send' });

        this.isInWalletAccount(recipientAddress).then((isValid) => {
          if (isValid) {
            state.setTransactionHistory(recipientAddress, networkKey, { ...transaction, action: 'received' });
          } else {
            console.log(`The recipient address [${recipientAddress}] is not in wallet.`);
          }
        }).catch((err) => console.warn(err));
      }

      portCallback(res);
    };
  }

  private makeCrossChainTransferCallback (
    address: string,
    recipientAddress: string,
    originalNetworkKey: string,
    value: string,
    token: string | undefined,
    portCallback: (res: ResponseTransfer) => void): (res: ResponseTransfer) => void {
    return (res: ResponseTransfer) => {
      // !res.isFinalized to prevent duplicate action
      if (!res.isFinalized && res.txResult && res.extrinsicHash) {
        const change = (parseInt(res.txResult.change) || parseInt(value)).toString();
        const transaction = {
          time: Date.now(),
          networkKey: originalNetworkKey,
          change: change,
          changeSymbol: res.txResult.changeSymbol || token,
          fee: res.txResult.fee,
          feeSymbol: res.txResult.feeSymbol,
          isSuccess: res.step.valueOf() === TransferStep.SUCCESS.valueOf(),
          extrinsicHash: res.extrinsicHash
        } as TransactionHistoryItemType;

        const setSendHistory = new Promise((resolve) => {
          state.setTransactionHistory(address, originalNetworkKey, { ...transaction, action: 'send' }, resolve);
        });

        setSendHistory.then(() => {
          this.isInWalletAccount(recipientAddress).then((isValid) => {
            if (isValid) {
              state.setTransactionHistory(recipientAddress, originalNetworkKey, { ...transaction, action: 'received' });
            } else {
              console.log(`The recipient address [${recipientAddress}] is not in wallet.`);
            }
          }).catch((err) => console.warn(err));
        }).catch((err) => console.warn(err));
      }

      portCallback(res);
    };
  }

  private async makeTransfer (id: string, port: chrome.runtime.Port, { from,
    networkKey,
    password,
    to,
    token,
    transferAll,
    value }: RequestTransfer): Promise<Array<TransferError>> {
    const cb = createSubscription<'pri(accounts.transfer)'>(id, port);
    const [errors, fromKeyPair, , tokenInfo] = await this.validateTransfer(networkKey, token, from, to, password, value, transferAll);

    if (errors.length) {
      setTimeout(() => {
        this.cancelSubscription(id);
      }, 500);

      // todo: add condition to lock KeyPair (for example: not remember password)
      fromKeyPair && fromKeyPair.lock();

      return errors;
    }

    if (fromKeyPair) {
      let transferProm: Promise<void> | undefined;

      if (isEthereumAddress(from) && isEthereumAddress(to)) {
        // Make transfer with EVM API
        const { privateKey } = this.accountExportPrivateKey({ address: from, password });
        const web3ApiMap = state.getApiMap().web3;

        if (tokenInfo && !tokenInfo.isMainToken && tokenInfo.erc20Address) {
          transferProm = makeERC20Transfer(
            tokenInfo.erc20Address, networkKey, from, to, privateKey, value || '0', !!transferAll, web3ApiMap,
            this.makeTransferCallback(from, to, networkKey, token, cb)
          );
        } else {
          transferProm = makeEVMTransfer(
            networkKey, to, privateKey, value || '0', !!transferAll, web3ApiMap,
            this.makeTransferCallback(from, to, networkKey, token, cb)
          );
        }
      } else {
        // Make transfer with Dotsama API
        transferProm = makeTransfer(
          networkKey, to, fromKeyPair, value || '0', !!transferAll, state.getDotSamaApiMap(), tokenInfo,
          this.makeTransferCallback(from, to, networkKey, token, cb)
        );
      }

      transferProm.then(() => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`Start transfer ${transferAll ? 'all' : value} from ${from} to ${to}`);

        // todo: add condition to lock KeyPair
        fromKeyPair.lock();
      })
        .catch((e) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,node/no-callback-literal,@typescript-eslint/no-unsafe-member-access
          cb({ step: TransferStep.ERROR, errors: [({ code: TransferErrorCode.TRANSFER_ERROR, message: e.message })] });
          console.error('Transfer error', e);
          setTimeout(() => {
            unsubscribe(id);
          }, 500);

          // todo: add condition to lock KeyPair
          fromKeyPair.lock();
        });
    }

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return errors;
  }

  private async makeCrossChainTransfer (id: string, port: chrome.runtime.Port,
    { destinationNetworkKey,
      from,
      originNetworkKey,
      password,
      to,
      token,
      value }: RequestCrossChainTransfer): Promise<Array<TransferError>> {
    const cb = createSubscription<'pri(accounts.crossChainTransfer)'>(id, port);
    const [errors, fromKeyPair, , tokenInfo] = await this.validateCrossChainTransfer(
      originNetworkKey,
      destinationNetworkKey,
      token, from, to, password, value);

    if (errors.length) {
      setTimeout(() => {
        this.cancelSubscription(id);
      }, 500);

      // todo: add condition to lock KeyPair (for example: not remember password)
      fromKeyPair && fromKeyPair.lock();

      return errors;
    }

    if (fromKeyPair && tokenInfo) {
      let transferProm: Promise<void> | undefined;

      // todo: Case ETH using web3 js

      const callback = this.makeCrossChainTransferCallback(from, to, originNetworkKey, value || '0', token, cb);

      // eslint-disable-next-line prefer-const
      transferProm = makeCrossChainTransfer(
        originNetworkKey, destinationNetworkKey,
        to, fromKeyPair,
        value || '0',
        state.getDotSamaApiMap(),
        tokenInfo,
        state.getNetworkMap(),
        callback
      );

      transferProm.then(() => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`Start cross-chain transfer ${value} from ${from} to ${to}`);

        // todo: add condition to lock KeyPair
        fromKeyPair.lock();
      })
        .catch((e) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,node/no-callback-literal,@typescript-eslint/no-unsafe-member-access
          cb({ step: TransferStep.ERROR, errors: [({ code: TransferErrorCode.TRANSFER_ERROR, message: e.message })] });
          console.error('Transfer error', e);
          setTimeout(() => {
            unsubscribe(id);
          }, 500);

          // todo: add condition to lock KeyPair
          fromKeyPair.lock();
        });
    }

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return errors;
  }

  private async evmNftGetTransaction ({ networkKey,
    params,
    recipientAddress,
    senderAddress }: EvmNftTransactionRequest): Promise<EvmNftTransaction> {
    const contractAddress = params.contractAddress as string;
    const tokenId = params.tokenId as string;
    const networkMap = state.getNetworkMap();

    try {
      const web3ApiMap = state.getWeb3ApiMap();
      const web3 = web3ApiMap[networkKey];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const contract = new web3.eth.Contract(ERC721Contract, contractAddress);

      const [fromAccountTxCount, gasPriceGwei, freeBalance] = await Promise.all([
        web3.eth.getTransactionCount(senderAddress),
        web3.eth.getGasPrice(),
        getFreeBalance(networkKey, senderAddress, state.getDotSamaApiMap(), state.getWeb3ApiMap())
      ]);

      const binaryFreeBalance = new BN(freeBalance);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
      const gasLimit = await contract.methods.safeTransferFrom(
        senderAddress,
        recipientAddress,
        tokenId
      ).estimateGas({
        from: senderAddress
      });

      const rawTransaction = {
        nonce: '0x' + fromAccountTxCount.toString(16),
        from: senderAddress,
        gasPrice: web3.utils.toHex(gasPriceGwei),
        gasLimit: web3.utils.toHex(gasLimit as number),
        to: contractAddress,
        value: '0x00',
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment
        data: contract.methods.safeTransferFrom(senderAddress, recipientAddress, tokenId).encodeABI()
      };
      const rawFee = gasLimit * parseFloat(gasPriceGwei);
      // @ts-ignore
      const estimatedFee = rawFee / (10 ** networkMap[networkKey].decimals);
      // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
      const feeString = estimatedFee.toString() + ' ' + networkMap[networkKey].nativeToken;

      const binaryFee = new BN(rawFee.toString());
      const balanceError = binaryFee.gt(binaryFreeBalance);

      return {
        tx: rawTransaction,
        estimatedFee: feeString,
        balanceError
      };
    } catch (e) {
      console.error('error handling web3 transfer nft', e);

      return {
        tx: null,
        estimatedFee: null,
        balanceError: false
      };
    }
  }

  private async evmNftSubmitTransaction (id: string, port: chrome.runtime.Port, { networkKey,
    password,
    rawTransaction,
    recipientAddress,
    senderAddress }: EvmNftSubmitTransaction): Promise<NftTransactionResponse> {
    const updateState = createSubscription<'pri(evmNft.submitTransaction)'>(id, port);
    let parsedPrivateKey = '';
    const network = state.getNetworkMapByKey(networkKey);
    const txState = {
      isSendingSelf: reformatAddress(senderAddress, 1) === reformatAddress(recipientAddress, 1)
    } as NftTransactionResponse;

    try {
      const { privateKey } = this.accountExportPrivateKey({ address: senderAddress, password });

      parsedPrivateKey = privateKey.slice(2);
      txState.passwordError = null;
      updateState(txState);
    } catch (e) {
      txState.passwordError = 'Unable to decode using the supplied passphrase';
      updateState(txState);

      port.onDisconnect.addListener((): void => {
        unsubscribe(id);
      });

      return txState;
    }

    try {
      const web3ApiMap = state.getWeb3ApiMap();
      const web3 = web3ApiMap[networkKey];

      const common = Common.forCustomChain('mainnet', {
        name: networkKey,
        networkId: network.evmChainId as number,
        chainId: network.evmChainId as number
      }, 'petersburg');
      // @ts-ignore
      const tx = new Transaction(rawTransaction, { common });

      tx.sign(Buffer.from(parsedPrivateKey, 'hex'));
      const callHash = tx.serialize();

      txState.callHash = callHash.toString('hex');
      updateState(txState);

      await web3.eth.sendSignedTransaction('0x' + callHash.toString('hex'))
        .then((receipt: Record<string, any>) => {
          if (receipt.status) {
            txState.status = receipt.status as boolean;
          }

          if (receipt.transactionHash) {
            txState.transactionHash = receipt.transactionHash as string;
          }

          updateState(txState);
        });
    } catch (e) {
      txState.txError = true;

      updateState(txState);
    }

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return txState;
  }

  private getNetworkMap (): Record<string, NetworkJson> {
    return state.getNetworkMap();
  }

  private subscribeNetworkMap (id: string, port: chrome.runtime.Port): Record<string, NetworkJson> {
    const cb = createSubscription<'pri(networkMap.getSubscription)'>(id, port);
    const networkMapSubscription = state.subscribeNetworkMap().subscribe({
      next: (rs) => {
        cb(rs);
      }
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      networkMapSubscription.unsubscribe();
    });

    return this.getNetworkMap();
  }

  private validateProvider (targetProviders: string[], _isEthereum: boolean) {
    let error: NETWORK_ERROR = NETWORK_ERROR.NONE;
    const currentNetworks = this.getNetworkMap();
    const allExistedProviders: Record<string, string | boolean>[] = [];
    let conflictKey = '';
    let conflictChain = '';

    // get all providers
    for (const [key, value] of Object.entries(currentNetworks)) {
      Object.values(value.providers).forEach((provider) => {
        allExistedProviders.push({ key, provider, isEthereum: value.isEthereum || false });
      });

      if (value.customProviders) {
        Object.values(value.customProviders).forEach((provider) => {
          allExistedProviders.push({ key, provider, isEthereum: value.isEthereum || false });
        });
      }
    }

    for (const _provider of targetProviders) {
      if (!isValidProvider(_provider)) {
        error = NETWORK_ERROR.INVALID_PROVIDER;
        break;
      }

      for (const { isEthereum, key, provider } of allExistedProviders) {
        if (provider === _provider && isEthereum === _isEthereum) {
          error = NETWORK_ERROR.EXISTED_PROVIDER;
          conflictKey = key as string;
          conflictChain = currentNetworks[key as string].chain;
          break;
        }
      }
    }

    return { error, conflictKey, conflictChain };
  }

  private validateGenesisHash (genesisHash: string) {
    let error: NETWORK_ERROR = NETWORK_ERROR.NONE;
    let conflictKey = '';
    let conflictChain = '';
    const currentNetworks = this.getNetworkMap();

    for (const network of Object.values(currentNetworks)) {
      if (network.genesisHash === genesisHash) {
        error = NETWORK_ERROR.EXISTED_NETWORK;
        conflictKey = network.key;
        conflictChain = network.chain;
        break;
      }
    }

    return { error, conflictKey, conflictChain };
  }

  private async upsertNetworkMap (data: NetworkJson): Promise<boolean> {
    try {
      return await state.upsertNetworkMap(data);
    } catch (e) {
      return false;
    }
  }

  private removeNetworkMap (networkKey: string): boolean {
    const currentNetworkMap = this.getNetworkMap();

    if (!(networkKey in currentNetworkMap)) {
      return false;
    }

    if (currentNetworkMap[networkKey].active) {
      return false;
    }

    return state.removeNetworkMap(networkKey);
  }

  private async disableNetworkMap (networkKey: string): Promise<DisableNetworkResponse> {
    const currentNetworkMap = this.getNetworkMap();

    if (!(networkKey in currentNetworkMap)) {
      return {
        success: false
      };
    }

    const success = await state.disableNetworkMap(networkKey);

    return {
      success
    };
  }

  private enableNetworkMap (networkKey: string): boolean {
    const networkMap = this.getNetworkMap();

    if (!(networkKey in networkMap)) {
      return false;
    }

    return state.enableNetworkMap(networkKey);
  }

  private async validateNetwork ({ existedNetwork,
    isEthereum,
    provider }: ValidateNetworkRequest): Promise<ValidateNetworkResponse> {
    let result: ValidateNetworkResponse = {
      success: false,
      key: '',
      genesisHash: '',
      ss58Prefix: '',
      networkGroup: [],
      chain: '',
      evmChainId: -1
    };

    try {
      const { conflictChain: providerConflictChain,
        conflictKey: providerConflictKey,
        error: providerError } = this.validateProvider([provider], false);

      if (providerError === NETWORK_ERROR.NONE) { // provider not duplicate
        let networkKey = '';
        const apiProps = initApi('custom', provider, isEthereum);
        const timeout = new Promise((resolve) => {
          const id = setTimeout(() => {
            clearTimeout(id);
            resolve(null);
          }, 5000);
        });

        const res = await Promise.race([
          timeout,
          apiProps.isReady
        ]); // check connection

        if (res !== null) { // test connection ok
          // get all necessary information
          const api = res as ApiProps;
          const { chainDecimals, chainTokens } = api.api.registry;
          const defaultToken = chainTokens[0];
          const defaultDecimal = chainDecimals[0];
          const genesisHash = api.api.genesisHash?.toHex();
          const ss58Prefix = api.api?.consts?.system?.ss58Prefix?.toString();
          let chainType: ChainType;
          let chain = '';
          let ethChainId = -1;

          if (isEthereum) {
            const web3 = initWeb3Api(provider);

            const [_chainType, _chain, _ethChainId] = await Promise.all([
              api.api.rpc.system.chainType(),
              api.api.rpc.system.chain(),
              web3.eth.getChainId()
            ]);

            chainType = _chainType;
            chain = _chain.toString();
            ethChainId = _ethChainId;

            if (existedNetwork && existedNetwork.evmChainId && existedNetwork.evmChainId !== ethChainId) {
              result.error = NETWORK_ERROR.PROVIDER_NOT_SAME_NETWORK;

              return result;
            }
          } else {
            const [_chainType, _chain] = await Promise.all([
              api.api.rpc.system.chainType(),
              api.api.rpc.system.chain()
            ]);

            chainType = _chainType;
            chain = _chain.toString();
          }

          networkKey = 'custom_' + genesisHash.toString();
          let parsedChainType: NetWorkGroup = 'UNKNOWN';

          if (chainType) {
            if (chainType.type === 'Development') {
              parsedChainType = 'TEST_NET';
            } else if (chainType.type === 'Live') {
              parsedChainType = 'MAIN_NET';
            }
          }

          // handle result
          if (existedNetwork) {
            if (existedNetwork.genesisHash !== genesisHash) {
              result.error = NETWORK_ERROR.PROVIDER_NOT_SAME_NETWORK;

              return result;
            } else { // no need to validate genesisHash
              result = {
                success: true,
                key: networkKey,
                genesisHash,
                ss58Prefix,
                networkGroup: [parsedChainType],
                chain: chain ? chain.toString() : '',
                evmChainId: ethChainId,
                nativeToken: defaultToken,
                decimal: defaultDecimal
              };
            }
          } else {
            const { conflictChain: genesisConflictChain,
              conflictKey: genesisConflictKey,
              error: genesisError } = this.validateGenesisHash(genesisHash);

            if (genesisError === NETWORK_ERROR.NONE) { // check genesisHash ok
              result = {
                success: true,
                key: networkKey,
                genesisHash,
                ss58Prefix,
                networkGroup: [parsedChainType],
                chain: chain ? chain.toString() : '',
                evmChainId: ethChainId,
                nativeToken: defaultToken,
                decimal: defaultDecimal
              };
            } else {
              result.error = genesisError;
              result.conflictKey = genesisConflictKey;
              result.conflictChain = genesisConflictChain;
            }
          }

          await api.api.disconnect();
        } else {
          result.error = NETWORK_ERROR.CONNECTION_FAILURE;
        }
      } else {
        result.error = providerError;
        result.conflictChain = providerConflictChain;
        result.conflictKey = providerConflictKey;
      }

      return result;
    } catch (e) {
      console.error('Error connecting to provider', e);

      return result;
    }
  }

  private enableAllNetwork (): boolean {
    return state.enableAllNetworks();
  }

  private async disableAllNetwork (): Promise<boolean> {
    return await state.disableAllNetworks();
  }

  private async resetDefaultNetwork (): Promise<boolean> {
    return await state.resetDefaultNetwork();
  }

  private recoverDotSamaApi (networkKey: string): boolean {
    try {
      return state.refreshDotSamaApi(networkKey);
    } catch (e) {
      console.error('error recovering dotsama api', e);

      return false;
    }
  }

  private subscribeEvmTokenState (id: string, port: chrome.runtime.Port): EvmTokenJson {
    const cb = createSubscription<'pri(evmTokenState.getSubscription)'>(id, port);

    const evmTokenSubscription = state.subscribeEvmToken().subscribe({
      next: (rs) => {
        cb(rs);
      }
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      evmTokenSubscription.unsubscribe();
    });

    return state.getEvmTokenState();
  }

  private getEvmTokenState () {
    return state.getEvmTokenState();
  }

  private upsertEvmToken (data: CustomEvmToken) {
    state.upsertEvmToken(data);

    return true;
  }

  private deleteEvmToken (data: DeleteEvmTokenParams[]) {
    state.deleteEvmTokens(data);

    return true;
  }

  private async validateEvmToken (data: ValidateEvmTokenRequest): Promise<ValidateEvmTokenResponse> {
    const evmTokenState = state.getEvmTokenState();
    let isExist = false;

    // check exist in evmTokenState
    for (const token of evmTokenState[data.type]) {
      if (token.smartContract.toLowerCase() === data.smartContract.toLowerCase() && token.type === data.type && token.chain === data.chain && !token.isDeleted) {
        isExist = true;
        break;
      }
    }

    if (!isExist && data.type === 'erc20') {
      // check exist in chainRegistry
      const chainRegistryMap = state.getChainRegistryMap();
      const tokenMap = chainRegistryMap[data.chain].tokenMap;

      for (const token of Object.values(tokenMap)) {
        if (token?.erc20Address?.toLowerCase() === data.smartContract.toLowerCase()) {
          isExist = true;
          break;
        }
      }
    }

    if (isExist) {
      return {
        name: '',
        symbol: '',
        isExist
      };
    }

    let tokenContract: Contract;
    let name: string;
    let decimals: number | undefined;
    let symbol: string;

    if (data.type === 'erc721') {
      tokenContract = getERC721Contract(data.chain, data.smartContract, state.getWeb3ApiMap());

      const [_name, _symbol] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        tokenContract.methods.name().call() as string,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        tokenContract.methods.symbol().call() as string
      ]);

      name = _name;
      symbol = _symbol;
    } else {
      tokenContract = getERC20Contract(data.chain, data.smartContract, state.getWeb3ApiMap());
      const [_name, _decimals, _symbol] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        tokenContract.methods.name().call() as string,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        tokenContract.methods.decimals().call() as number,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        tokenContract.methods.symbol().call() as string
      ]);

      name = _name;
      decimals = _decimals;
      symbol = _symbol;
    }

    return {
      name,
      decimals,
      symbol,
      isExist
    };
  }

  private async subscribeAddressFreeBalance ({ address,
    networkKey,
    token }: RequestFreeBalance, id: string, port: chrome.runtime.Port): Promise<string> {
    const cb = createSubscription<'pri(freeBalance.subscribe)'>(id, port);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-assignment
    this.cancelSubscriptionMap[id] = await subscribeFreeBalance(networkKey, address, state.getDotSamaApiMap(), state.getWeb3ApiMap(), token, cb);

    port.onDisconnect.addListener((): void => {
      this.cancelSubscription(id);
    });

    return id;
  }

  private async transferCheckReferenceCount ({ address,
    networkKey }: RequestTransferCheckReferenceCount): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
    return await checkReferenceCount(networkKey, address, state.getDotSamaApiMap());
  }

  private async transferCheckSupporting ({ networkKey,
    token }: RequestTransferCheckSupporting): Promise<SupportTransferResponse> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
    return await checkSupportTransfer(networkKey, token, state.getDotSamaApiMap());
  }

  private async transferGetExistentialDeposit ({ networkKey, token }: RequestTransferExistentialDeposit): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-return
    return await getExistentialDeposit(networkKey, token, state.getDotSamaApiMap());
  }

  private async substrateNftGetTransaction ({ networkKey, params, recipientAddress, senderAddress }: SubstrateNftTransactionRequest): Promise<SubstrateNftTransaction> {
    const networkJson = state.getNetworkMapByKey(networkKey);

    switch (networkKey) {
      case SUPPORTED_TRANSFER_SUBSTRATE_CHAIN_NAME.acala:
        return await acalaTransferHandler(networkKey, state.getDotSamaApiMap(), state.getWeb3ApiMap(), senderAddress, recipientAddress, params, networkJson);
      case SUPPORTED_TRANSFER_SUBSTRATE_CHAIN_NAME.karura:
        return await acalaTransferHandler(networkKey, state.getDotSamaApiMap(), state.getWeb3ApiMap(), senderAddress, recipientAddress, params, networkJson);
      case SUPPORTED_TRANSFER_SUBSTRATE_CHAIN_NAME.kusama:
        return await rmrkTransferHandler(networkKey, state.getDotSamaApiMap(), state.getWeb3ApiMap(), senderAddress, recipientAddress, params, networkJson);
      case SUPPORTED_TRANSFER_SUBSTRATE_CHAIN_NAME.uniqueNft:
        return await uniqueTransferHandler(networkKey, state.getDotSamaApiMap(), state.getWeb3ApiMap(), senderAddress, recipientAddress, params, networkJson);
      case SUPPORTED_TRANSFER_SUBSTRATE_CHAIN_NAME.quartz:
        return await quartzTransferHandler(networkKey, state.getDotSamaApiMap(), state.getWeb3ApiMap(), senderAddress, recipientAddress, params, networkJson);
      case SUPPORTED_TRANSFER_SUBSTRATE_CHAIN_NAME.opal:
        return await quartzTransferHandler(networkKey, state.getDotSamaApiMap(), state.getWeb3ApiMap(), senderAddress, recipientAddress, params, networkJson);
      case SUPPORTED_TRANSFER_SUBSTRATE_CHAIN_NAME.statemine:
        return await statemineTransferHandler(networkKey, state.getDotSamaApiMap(), state.getWeb3ApiMap(), senderAddress, recipientAddress, params, networkJson);
      case SUPPORTED_TRANSFER_SUBSTRATE_CHAIN_NAME.statemint:
        return await statemineTransferHandler(networkKey, state.getDotSamaApiMap(), state.getWeb3ApiMap(), senderAddress, recipientAddress, params, networkJson);
      case SUPPORTED_TRANSFER_SUBSTRATE_CHAIN_NAME.bitcountry:
        return await acalaTransferHandler(networkKey, state.getDotSamaApiMap(), state.getWeb3ApiMap(), senderAddress, recipientAddress, params, networkJson);
    }

    return {
      error: true,
      balanceError: false
    };
  }

  private async substrateNftSubmitTransaction (id: string, port: chrome.runtime.Port, { params,
    password,
    recipientAddress,
    senderAddress }: SubstrateNftSubmitTransaction): Promise<NftTransactionResponse> {
    const txState: NftTransactionResponse = { isSendingSelf: false };

    if (params === null) {
      txState.txError = true;

      return txState;
    }

    const updateState = createSubscription<'pri(substrateNft.submitTransaction)'>(id, port);
    const networkKey = params.networkKey as string;
    const extrinsic = getNftTransferExtrinsic(networkKey, state.getDotSamaApi(networkKey), senderAddress, recipientAddress, params);
    const passwordError: string | null = unlockAccount(senderAddress, password);

    if (extrinsic !== null && passwordError === null) {
      const pair = keyring.getPair(senderAddress);

      txState.isSendingSelf = isRecipientSelf(senderAddress, recipientAddress);
      txState.callHash = extrinsic.method.hash.toHex();
      updateState(txState);

      try {
        const unsubscribe = await extrinsic.signAndSend(pair, (result) => {
          if (!result || !result.status) {
            return;
          }

          if (result.status.isInBlock || result.status.isFinalized) {
            result.events
              .filter(({ event: { section } }) => section === 'system')
              .forEach(({ event: { method } }): void => {
                txState.transactionHash = extrinsic.hash.toHex();
                updateState(txState);

                if (method === 'ExtrinsicFailed') {
                  txState.status = false;
                  updateState(txState);
                } else if (method === 'ExtrinsicSuccess') {
                  txState.status = true;
                  updateState(txState);
                }
              });
          } else if (result.isError) {
            txState.txError = true;
            updateState(txState);
          }

          if (result.isCompleted) {
            unsubscribe();
          }
        });
      } catch (e) {
        console.error('error transferring nft', e);
        txState.txError = true;
        updateState(txState);
      }
    } else {
      txState.passwordError = passwordError;
      updateState(txState);
    }

    return txState;
  }

  private parseSubstrateTransaction ({ genesisHash,
    rawPayload,
    specVersion }: RequestParseTransactionSubstrate): ResponseParseTransactionSubstrate {
    return parseSubstratePayload(genesisHash, rawPayload, specVersion);
  }

  private async parseEVMTransaction ({ data }: RequestParseTransactionEVM): Promise<ResponseParseTransactionEVM> {
    return await parseEVMTransaction(data, state.getNetworkMap());
  }

  private enableNetworks (targetKeys: string[]) {
    try {
      for (const networkKey of targetKeys) {
        this.enableNetworkMap(networkKey);
      }
    } catch (e) {
      return false;
    }

    return true;
  }

  private async disableNetworks (targetKeys: string[]) {
    try {
      for (const key of targetKeys) {
        await this.disableNetworkMap(key);
      }
    } catch (e) {
      return false;
    }

    return true;
  }

  private getAccountMeta ({ address }: RequestAccountMeta): ResponseAccountMeta {
    const pair = keyring.getPair(address);

    assert(pair, 'Unable to find pair');

    return {
      meta: pair.meta
    };
  }

  private async isInWalletAccount (address?: string) {
    return new Promise((resolve) => {
      if (address) {
        accountsObservable.subject.subscribe((storedAccounts: SubjectInfo): void => {
          if (storedAccounts[address]) {
            resolve(true);
          }

          resolve(false);
        });
      } else {
        resolve(false);
      }
    });
  }

  private accountsTie2 ({ address, genesisHash }: RequestAccountTie): boolean {
    return state.setAccountTie(address, genesisHash);
  }

  private async accountsCreateExternalV2 ({ address,
    genesisHash,
    isAllowed,
    isEthereum,
    name }: RequestAccountCreateExternalV2): Promise<AccountExternalError[]> {
    try {
      let result: KeyringPair;

      try {
        const exists = keyring.getPair(address);

        if (exists) {
          if (exists.type === (isEthereum ? 'ethereum' : 'sr25519')) {
            return [{ code: AccountExternalErrorCode.INVALID_ADDRESS, message: 'Account exists' }];
          }
        }
      } catch (e) {

      }

      if (isEthereum) {
        result = keyring.keyring.addFromAddress(address, { name, isExternal: true }, null, 'ethereum');

        keyring.saveAccount(result);
      } else {
        result = keyring.addExternal(address, { genesisHash, name }).pair;
      }

      const _address = result.address;

      await new Promise<void>((resolve) => {
        state.addAccountRef([_address], () => {
          resolve();
        });
      });

      await new Promise<void>((resolve) => {
        this._saveCurrentAccountAddress(_address, () => {
          this._addAddressToAuthList(_address, isAllowed);
          resolve();
        });
      });

      return [];
    } catch (e) {
      return [{ code: AccountExternalErrorCode.KEYRING_ERROR, message: (e as Error).message }];
    }
  }

  private async accountsCreateHardwareV2 ({ accountIndex,
    address,
    addressOffset,
    genesisHash,
    hardwareType,
    isAllowed,
    name }: RequestAccountCreateHardwareV2): Promise<boolean> {
    const key = keyring.addHardware(address, hardwareType, {
      accountIndex,
      addressOffset,
      genesisHash,
      name,
      originGenesisHash: genesisHash
    });

    const result = key.pair;

    const _address = result.address;

    await new Promise<void>((resolve) => {
      state.addAccountRef([_address], () => {
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      this._saveCurrentAccountAddress(_address, () => {
        this._addAddressToAuthList(_address, isAllowed || false);
        resolve();
      });
    });

    return true;
  }

  // External account QR

  private async validateExternalAccountTransfer (networkKey: string, token: string | undefined, from: string, to: string, value: string | undefined, transferAll: boolean | undefined): Promise<[Array<TransferError>, KeyringPair | undefined, BN | undefined, TokenInfo | undefined]> {
    const dotSamaApiMap = state.getDotSamaApiMap();
    const errors = [] as Array<TransferError>;
    let keypair: KeyringPair | undefined;
    let transferValue;

    if (!transferAll) {
      try {
        if (value === undefined) {
          errors.push({
            code: TransferErrorCode.INVALID_VALUE,
            message: 'Require transfer value'
          });
        }

        if (value) {
          transferValue = new BN(value);
        }
      } catch (e) {
        errors.push({
          code: TransferErrorCode.INVALID_VALUE,
          // @ts-ignore
          message: String(e.message)
        });
      }
    }

    try {
      keypair = keyring.getPair(from);
    } catch (e) {
      errors.push({
        code: TransferErrorCode.KEYRING_ERROR,
        // @ts-ignore
        message: String(e.message)
      });
    }

    let tokenInfo: TokenInfo | undefined;

    if (token) {
      tokenInfo = await getTokenInfo(networkKey, dotSamaApiMap[networkKey].api, token);

      if (!tokenInfo) {
        errors.push({
          code: TransferErrorCode.INVALID_TOKEN,
          message: 'Not found token from registry'
        });
      }

      if (isEthereumAddress(from) && isEthereumAddress(to) && !tokenInfo?.isMainToken && !(tokenInfo?.erc20Address)) {
        errors.push({
          code: TransferErrorCode.INVALID_TOKEN,
          message: 'Not found ERC20 address for this token'
        });
      }
    }

    return [errors, keypair, transferValue, tokenInfo];
  }

  private validateAccountExternal (address: string): [Array<BaseTxError>, KeyringPair | undefined] {
    const errors = [] as Array<BaseTxError>;
    let keypair: KeyringPair | undefined;

    try {
      keypair = keyring.getPair(address);
    } catch (e) {
      errors.push({
        code: BasicTxErrorCode.KEYRING_ERROR,
        // @ts-ignore
        message: String(e.message)
      });
    }

    return [errors, keypair];
  }

  private async makeTransferQR (id: string, port: chrome.runtime.Port, { from,
    networkKey,
    to,
    token,
    transferAll,
    value }: RequestTransferExternal): Promise<Array<TransferError>> {
    const cb = createSubscription<'pri(accounts.transfer.qr.create)'>(id, port);
    const [errors, fromKeyPair, , tokenInfo] = await this.validateExternalAccountTransfer(networkKey, token, from, to, value, transferAll);

    if (errors.length) {
      setTimeout(() => {
        this.cancelSubscription(id);
      }, 500);

      return errors;
    }

    if (fromKeyPair) {
      const id: string = getId();

      state.cleanExternalRequest();

      const setState = (promise: ExternalRequestPromise) => {
        state.setExternalRequestMap(id, promise);
      };

      const updateState = (promise: Partial<ExternalRequestPromise>) => {
        state.updateExternalRequest(id, { ...promise, resolve: undefined, reject: undefined });
      };

      const callback = this.makeTransferCallback(from, to, networkKey, token, cb);

      let transferProm: Promise<void>;

      if (isEthereumAddress(from) && isEthereumAddress(to)) {
        const web3ApiMap = state.getApiMap().web3;
        const chainId = state.getNetworkMap()[networkKey].evmChainId || 1;

        if (tokenInfo && !tokenInfo.isMainToken && tokenInfo.erc20Address) {
          transferProm = makeERC20TransferQr(
            {
              assetAddress: tokenInfo.erc20Address,
              callback,
              chainId,
              from,
              id,
              networkKey,
              setState,
              updateState,
              to,
              transferAll: !!transferAll,
              value: value || '0',
              web3ApiMap
            }
          );
        } else {
          transferProm = makeEVMTransferQr({
            callback,
            chainId,
            from,
            id,
            networkKey,
            setState,
            to,
            updateState,
            transferAll: !!transferAll,
            value: value || '0',
            web3ApiMap
          });
        }
      } else {
        const apiProps = await state.getDotSamaApiMap()[networkKey].isReady;

        transferProm = makeTransferQr({
          networkKey,
          recipientAddress: to,
          senderAddress: fromKeyPair.address,
          value: value || '0',
          transferAll: !!transferAll,
          tokenInfo,
          id,
          setState,
          updateState,
          callback,
          apiProps: apiProps
        });
      }

      transferProm.then(() => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`Start transfer ${transferAll ? 'all' : value} from ${from} to ${to}`);
      })
        .catch((e) => {
          if (e) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,node/no-callback-literal,@typescript-eslint/no-unsafe-member-access
            cb({ step: TransferStep.ERROR, errors: [({ code: TransferErrorCode.TRANSFER_ERROR, message: e.message })] });
            console.error('Transfer error', e);
          }

          setTimeout(() => {
            unsubscribe(id);
          }, 500);
        });
    }

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return errors;
  }

  private async makeCrossChainTransferQr (id: string, port: chrome.runtime.Port, { destinationNetworkKey,
    from,
    originNetworkKey,
    to,
    token,
    value }: RequestCrossChainTransferExternal): Promise<Array<TransferError>> {
    const cb = createSubscription<'pri(accounts.cross.transfer.qr.create)'>(id, port);
    const [errors, fromKeyPair, , tokenInfo] = await this.validateCrossChainTransfer(
      originNetworkKey,
      destinationNetworkKey,
      token, from, to, undefined, value);

    if (errors.length) {
      setTimeout(() => {
        this.cancelSubscription(id);
      }, 500);

      return errors;
    }

    if (fromKeyPair && tokenInfo) {
      const id: string = getId();

      state.cleanExternalRequest();

      const setState = (promise: ExternalRequestPromise) => {
        state.setExternalRequestMap(id, promise);
      };

      const updateState = (promise: Partial<ExternalRequestPromise>) => {
        state.updateExternalRequest(id, { ...promise, resolve: undefined, reject: undefined });
      };

      const callback = this.makeCrossChainTransferCallback(from, to, originNetworkKey, value || '0', token, cb);

      const transferProm = makeCrossChainTransferQr({
        originalNetworkKey: originNetworkKey,
        destinationNetworkKey,
        recipientAddress: to,
        senderAddress: fromKeyPair.address,
        value: value || '0',
        dotSamaApiMap: state.getDotSamaApiMap(),
        tokenInfo,
        networkMap: state.getNetworkMap(),
        id,
        setState,
        updateState,
        callback
      });

      transferProm.then(() => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`Start cross-chain transfer ${value} from ${from} to ${to}`);
      })
        .catch((e) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,node/no-callback-literal,@typescript-eslint/no-unsafe-member-access
          cb({ step: TransferStep.ERROR, errors: [({ code: TransferErrorCode.TRANSFER_ERROR, message: e.message })] });
          console.error('Transfer error', e);
          setTimeout(() => {
            unsubscribe(id);
          }, 500);
        });
    }

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return errors;
  }

  private nftTransferCreateQrSubstrate (id: string,
    port: chrome.runtime.Port,
    { params,
      recipientAddress,
      senderAddress }: RequestNftTransferExternalSubstrate): Array<BaseTxError> {
    const callback = createSubscription<'pri(nft.transfer.qr.create.substrate)'>(id, port);
    const [errors, fromKeyPair] = this.validateAccountExternal(senderAddress);

    if (errors.length) {
      setTimeout(() => {
        this.cancelSubscription(id);
      }, 500);

      return errors;
    }

    if (params === null) {
      return [{ code: BasicTxErrorCode.INVALID_PARAM, message: 'Invalid transfer param' }];
    }

    if (fromKeyPair) {
      const id: string = getId();

      state.cleanExternalRequest();

      const setState = (promise: ExternalRequestPromise) => {
        state.setExternalRequestMap(id, promise);
      };

      const updateState = (promise: Partial<ExternalRequestPromise>) => {
        state.updateExternalRequest(id, { ...promise, resolve: undefined, reject: undefined });
      };

      const networkKey = params.networkKey as string;
      const apiProp = state.getDotSamaApi(networkKey);

      const transferProm = makeNftTransferQr({
        callback,
        senderAddress: fromKeyPair.address,
        qrId: id,
        setState,
        updateState,
        apiProp,
        recipientAddress,
        params,
        networkKey
      });

      transferProm.then(() => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`Start transfer nft from ${senderAddress} to ${recipientAddress}`);
      })
        .catch((e) => {
          if (!e) {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true, isSendingSelf: false });
          } else {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true, isSendingSelf: false, status: false });
          }

          console.error('Error transferring nft', e);
          setTimeout(() => {
            unsubscribe(id);
          }, 500);
        });
    }

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return errors;
  }

  private nftTransferCreateQrEvm (
    id: string,
    port: chrome.runtime.Port,
    { networkKey,
      rawTransaction,
      recipientAddress,
      senderAddress }: RequestNftTransferExternalEVM
  ): Array<BaseTxError> {
    const callback = createSubscription<'pri(nft.transfer.qr.create.evm)'>(id, port);
    const network = state.getNetworkMapByKey(networkKey);
    const isSendingSelf = reformatAddress(senderAddress, 1) === reformatAddress(recipientAddress, 1);

    try {
      const web3ApiMap = state.getWeb3ApiMap();

      const id: string = getId();

      state.cleanExternalRequest();

      const setState = (promise: ExternalRequestPromise) => {
        state.setExternalRequestMap(id, promise);
      };

      const updateState = (promise: Partial<ExternalRequestPromise>) => {
        state.updateExternalRequest(id, { ...promise, resolve: undefined, reject: undefined });
      };

      const transferProm = handleTransferNftQr({
        callback,
        chainId: network.evmChainId || 1,
        isSendingSelf: isSendingSelf,
        id: id,
        setState,
        updateState,
        web3ApiMap,
        rawTransaction,
        networkKey,
        from: senderAddress
      });

      transferProm.then(() => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`Start transfer nft from ${senderAddress} to ${recipientAddress}`);
      })
        .catch((e) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,node/no-callback-literal,@typescript-eslint/no-unsafe-member-access
          if (!e) {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true, isSendingSelf: false });
          } else {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true, isSendingSelf: false, status: false });
          }

          console.error('Error transferring nft', e);
          setTimeout(() => {
            unsubscribe(id);
          }, 500);
        });
    } catch (e) {
      return [{ code: BasicTxErrorCode.TRANSFER_ERROR, message: (e as Error).message }];
    }

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return [];
  }

  private stakeCreateQr (id: string, port: chrome.runtime.Port, { amount,
    bondedValidators,
    isBondedBefore,
    lockPeriod,
    networkKey,
    nominatorAddress,
    validatorInfo }: RequestStakeExternal): Array<BaseTxError> {
    const callback = createSubscription<'pri(stake.qr.create)'>(id, port);

    const network = state.getNetworkMapByKey(networkKey);

    if (!amount || !nominatorAddress || !validatorInfo) {
      return [{ code: BasicTxErrorCode.INVALID_PARAM, message: 'Invalid params' }];
    }

    const apiProp = state.getDotSamaApi(networkKey);

    try {
      const id: string = getId();

      state.cleanExternalRequest();

      const setState = (promise: ExternalRequestPromise) => {
        state.setExternalRequestMap(id, promise);
      };

      const updateState = (promise: Partial<ExternalRequestPromise>) => {
        state.updateExternalRequest(id, { ...promise, resolve: undefined, reject: undefined });
      };

      const prom = createStakeQr({
        apiProp: apiProp,
        id: id,
        bondedValidators: bondedValidators,
        network: network,
        amount: amount,
        isBondedBefore: isBondedBefore,
        validatorInfo: validatorInfo,
        nominatorAddress: nominatorAddress,
        updateState: updateState,
        setState: setState,
        callback: callback
      });

      prom.then(() => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`Start staking from ${nominatorAddress}`);
      })
        .catch((e) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,node/no-callback-literal,@typescript-eslint/no-unsafe-member-access
          if (!e) {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true });
          } else {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true, status: false });
          }

          console.error('Error staking', e);
          setTimeout(() => {
            unsubscribe(id);
          }, 500);
        });
    } catch (e) {
      return [{ code: BasicTxErrorCode.STAKING_ERROR, message: (e as Error).message }];
    }

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return [];
  }

  private unStakeCreateQr (id: string, port: chrome.runtime.Port, { address,
    amount,
    networkKey,
    unstakeAll,
    validatorAddress }: RequestUnStakeExternal): Array<BaseTxError> {
    const callback = createSubscription<'pri(unStake.qr.create)'>(id, port);

    const network = state.getNetworkMapByKey(networkKey);

    if (!amount || !address) {
      return [{ code: BasicTxErrorCode.INVALID_PARAM, message: 'Invalid params' }];
    }

    const apiProp = state.getDotSamaApi(networkKey);

    try {
      const id: string = getId();

      state.cleanExternalRequest();

      const setState = (promise: ExternalRequestPromise) => {
        state.setExternalRequestMap(id, promise);
      };

      const updateState = (promise: Partial<ExternalRequestPromise>) => {
        state.updateExternalRequest(id, { ...promise, resolve: undefined, reject: undefined });
      };

      const prom = createUnStakeQr({
        apiProp: apiProp,
        id: id,
        address: address,
        network: network,
        amount: amount,
        updateState: updateState,
        setState: setState,
        validatorAddress: validatorAddress,
        unstakeAll: unstakeAll,
        callback: callback
      });

      prom.then(() => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`Start un-staking from ${address}`);
      })
        .catch((e) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,node/no-callback-literal,@typescript-eslint/no-unsafe-member-access
          if (!e) {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true });
          } else {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true, status: false });
          }

          console.error('Error un-staking', e);
          setTimeout(() => {
            unsubscribe(id);
          }, 500);
        });
    } catch (e) {
      return [{ code: BasicTxErrorCode.UN_STAKING_ERROR, message: (e as Error).message }];
    }

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return [];
  }

  private withdrawStakeCreateQr (id: string, port: chrome.runtime.Port, { action,
    address,
    networkKey,
    validatorAddress }: RequestWithdrawStakeExternal): Array<BaseTxError> {
    const callback = createSubscription<'pri(withdrawStake.qr.create)'>(id, port);
    const apiProp = state.getDotSamaApi(networkKey);

    if (!address) {
      return [{ code: BasicTxErrorCode.INVALID_PARAM, message: 'Invalid params' }];
    }

    try {
      const id: string = getId();

      state.cleanExternalRequest();

      const setState = (promise: ExternalRequestPromise) => {
        state.setExternalRequestMap(id, promise);
      };

      const updateState = (promise: Partial<ExternalRequestPromise>) => {
        state.updateExternalRequest(id, { ...promise, resolve: undefined, reject: undefined });
      };

      const prom = createWithdrawStakeQr({
        action: action,
        address: address,
        apiProp: apiProp,
        callback: callback,
        id: id,
        networkKey: networkKey,
        setState: setState,
        updateState: updateState,
        validatorAddress: validatorAddress
      });

      prom.then(() => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`Start withdraw-staking from ${address}`);
      })
        .catch((e) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,node/no-callback-literal,@typescript-eslint/no-unsafe-member-access
          if (!e) {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true });
          } else {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true, status: false });
          }

          console.error('Error withdraw-staking', e);
          setTimeout(() => {
            unsubscribe(id);
          }, 500);
        });
    } catch (e) {
      return [{ code: BasicTxErrorCode.WITHDRAW_STAKING_ERROR, message: (e as Error).message }];
    }

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return [];
  }

  // External account Ledger

  private async makeTransferLedger (id: string, port: chrome.runtime.Port, { from,
    networkKey,
    to,
    token,
    transferAll,
    value }: RequestTransferExternal): Promise<Array<TransferError>> {
    const cb = createSubscription<'pri(accounts.transfer.ledger.create)'>(id, port);
    const [errors, fromKeyPair, , tokenInfo] = await this.validateExternalAccountTransfer(networkKey, token, from, to, value, transferAll);

    if (errors.length) {
      setTimeout(() => {
        this.cancelSubscription(id);
      }, 500);

      return errors;
    }

    if (fromKeyPair) {
      // Make transfer with Dotsama API
      const id: string = getId();

      state.cleanExternalRequest();

      const setState = (promise: ExternalRequestPromise) => {
        state.setExternalRequestMap(id, promise);
      };

      const updateState = (promise: Partial<ExternalRequestPromise>) => {
        state.updateExternalRequest(id, { ...promise, resolve: undefined, reject: undefined });
      };

      const callback = this.makeTransferCallback(from, to, networkKey, token, cb);

      const apiProps = await state.getDotSamaApiMap()[networkKey].isReady;

      const transferProm = makeTransferLedger({
        networkKey,
        recipientAddress: to,
        senderAddress: fromKeyPair.address,
        value: value || '0',
        transferAll: !!transferAll,
        tokenInfo,
        id,
        setState,
        updateState,
        callback,
        apiProps: apiProps
      });

      transferProm.then(() => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`Start transfer ${transferAll ? 'all' : value} from ${from} to ${to}`);
      })
        .catch((e) => {
          if (e) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,node/no-callback-literal,@typescript-eslint/no-unsafe-member-access
            cb({ step: TransferStep.ERROR, errors: [({ code: TransferErrorCode.TRANSFER_ERROR, message: e.message })] });
            console.error('Transfer error', e);
          }

          setTimeout(() => {
            unsubscribe(id);
          }, 500);
        });
    }

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return errors;
  }

  private async makeCrossChainTransferLedger (id: string, port: chrome.runtime.Port, { destinationNetworkKey,
    from,
    originNetworkKey,
    to,
    token,
    value }: RequestCrossChainTransferExternal): Promise<Array<TransferError>> {
    const cb = createSubscription<'pri(accounts.cross.transfer.ledger.create)'>(id, port);
    const [errors, fromKeyPair, , tokenInfo] = await this.validateCrossChainTransfer(
      originNetworkKey,
      destinationNetworkKey,
      token, from, to, undefined, value);

    if (errors.length) {
      setTimeout(() => {
        this.cancelSubscription(id);
      }, 500);

      return errors;
    }

    if (fromKeyPair && tokenInfo) {
      const id: string = getId();

      state.cleanExternalRequest();

      const setState = (promise: ExternalRequestPromise) => {
        state.setExternalRequestMap(id, promise);
      };

      const updateState = (promise: Partial<ExternalRequestPromise>) => {
        state.updateExternalRequest(id, { ...promise, resolve: undefined, reject: undefined });
      };

      const callback = this.makeCrossChainTransferCallback(from, to, originNetworkKey, value || '0', token, cb);

      const transferProm = makeCrossChainTransferLedger({
        originalNetworkKey: originNetworkKey,
        destinationNetworkKey,
        recipientAddress: to,
        senderAddress: fromKeyPair.address,
        value: value || '0',
        dotSamaApiMap: state.getDotSamaApiMap(),
        tokenInfo,
        networkMap: state.getNetworkMap(),
        id,
        setState,
        updateState,
        callback
      });

      transferProm.then(() => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`Start cross-chain transfer ${value} from ${from} to ${to}`);
      })
        .catch((e) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,node/no-callback-literal,@typescript-eslint/no-unsafe-member-access
          cb({ step: TransferStep.ERROR, errors: [({ code: TransferErrorCode.TRANSFER_ERROR, message: e.message })] });
          console.error('Transfer error', e);
          setTimeout(() => {
            unsubscribe(id);
          }, 500);
        });
    }

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return errors;
  }

  private nftTransferCreateLedgerSubstrate (id: string,
    port: chrome.runtime.Port,
    { params,
      recipientAddress,
      senderAddress }: RequestNftTransferExternalSubstrate): Array<BaseTxError> {
    const callback = createSubscription<'pri(nft.transfer.ledger.create.substrate)'>(id, port);
    const [errors, fromKeyPair] = this.validateAccountExternal(senderAddress);

    if (errors.length) {
      setTimeout(() => {
        this.cancelSubscription(id);
      }, 500);

      return errors;
    }

    if (params === null) {
      return [{ code: BasicTxErrorCode.INVALID_PARAM, message: 'Invalid transfer param' }];
    }

    if (fromKeyPair) {
      const id: string = getId();

      state.cleanExternalRequest();

      const setState = (promise: ExternalRequestPromise) => {
        state.setExternalRequestMap(id, promise);
      };

      const updateState = (promise: Partial<ExternalRequestPromise>) => {
        state.updateExternalRequest(id, { ...promise, resolve: undefined, reject: undefined });
      };

      const networkKey = params.networkKey as string;
      const apiProp = state.getDotSamaApi(networkKey);

      const transferProm = makeNftTransferLedger({
        callback,
        senderAddress: fromKeyPair.address,
        qrId: id,
        setState,
        updateState,
        apiProp,
        recipientAddress,
        params,
        networkKey
      });

      transferProm.then(() => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`Start transfer nft from ${senderAddress} to ${recipientAddress}`);
      })
        .catch((e) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,node/no-callback-literal,@typescript-eslint/no-unsafe-member-access
          if (!e) {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true, isSendingSelf: false });
          } else {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true, isSendingSelf: false, status: false });
          }

          console.error('Error transferring nft', e);
          setTimeout(() => {
            unsubscribe(id);
          }, 500);
        });
    }

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return errors;
  }

  private stakeCreateLedger (id: string, port: chrome.runtime.Port, { amount,
    bondedValidators,
    isBondedBefore,
    networkKey,
    nominatorAddress,
    validatorInfo }: RequestStakeExternal): Array<BaseTxError> {
    const callback = createSubscription<'pri(stake.ledger.create)'>(id, port);

    const network = state.getNetworkMapByKey(networkKey);

    if (!amount || !nominatorAddress || !validatorInfo) {
      return [{ code: BasicTxErrorCode.INVALID_PARAM, message: 'Invalid params' }];
    }

    const apiProp = state.getDotSamaApi(networkKey);

    try {
      const id: string = getId();

      state.cleanExternalRequest();

      const setState = (promise: ExternalRequestPromise) => {
        state.setExternalRequestMap(id, promise);
      };

      const updateState = (promise: Partial<ExternalRequestPromise>) => {
        state.updateExternalRequest(id, { ...promise, resolve: undefined, reject: undefined });
      };

      const prom = createStakeLedger({
        apiProp: apiProp,
        id: id,
        bondedValidators: bondedValidators,
        network: network,
        amount: amount,
        isBondedBefore: isBondedBefore,
        validatorInfo: validatorInfo,
        nominatorAddress: nominatorAddress,
        updateState: updateState,
        setState: setState,
        callback: callback
      });

      prom.then(() => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`Start staking from ${nominatorAddress}`);
      })
        .catch((e) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,node/no-callback-literal,@typescript-eslint/no-unsafe-member-access
          if (!e) {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true });
          } else {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true, status: false });
          }

          console.error('Error transferring nft', e);
          setTimeout(() => {
            unsubscribe(id);
          }, 500);
        });
    } catch (e) {
      return [{ code: BasicTxErrorCode.STAKING_ERROR, message: (e as Error).message }];
    }

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return [];
  }

  private unStakeCreateLedger (id: string, port: chrome.runtime.Port, { address,
    amount,
    networkKey }: RequestUnStakeExternal): Array<BaseTxError> {
    const callback = createSubscription<'pri(unStake.ledger.create)'>(id, port);

    const network = state.getNetworkMapByKey(networkKey);

    if (!amount || !address) {
      return [{ code: BasicTxErrorCode.INVALID_PARAM, message: 'Invalid params' }];
    }

    const apiProp = state.getDotSamaApi(networkKey);

    try {
      const id: string = getId();

      state.cleanExternalRequest();

      const setState = (promise: ExternalRequestPromise) => {
        state.setExternalRequestMap(id, promise);
      };

      const updateState = (promise: Partial<ExternalRequestPromise>) => {
        state.updateExternalRequest(id, { ...promise, resolve: undefined, reject: undefined });
      };

      const prom = createUnStakeLedger({
        apiProp: apiProp,
        id: id,
        address: address,
        network: network,
        amount: amount,
        updateState: updateState,
        setState: setState,
        callback: callback
      });

      prom.then(() => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`Start un-staking from ${address}`);
      })
        .catch((e) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,node/no-callback-literal,@typescript-eslint/no-unsafe-member-access
          if (!e) {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true });
          } else {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true, status: false });
          }

          console.error('Error un-staking', e);
          setTimeout(() => {
            unsubscribe(id);
          }, 500);
        });
    } catch (e) {
      return [{ code: BasicTxErrorCode.UN_STAKING_ERROR, message: (e as Error).message }];
    }

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return [];
  }

  private withdrawStakeCreateLedger (id: string, port: chrome.runtime.Port, { action,
    address,
    networkKey,
    validatorAddress }: RequestWithdrawStakeExternal): Array<BaseTxError> {
    const callback = createSubscription<'pri(withdrawStake.ledger.create)'>(id, port);
    const apiProp = state.getDotSamaApi(networkKey);

    if (!address) {
      return [{ code: BasicTxErrorCode.INVALID_PARAM, message: 'Invalid params' }];
    }

    try {
      const id: string = getId();

      state.cleanExternalRequest();

      const setState = (promise: ExternalRequestPromise) => {
        state.setExternalRequestMap(id, promise);
      };

      const updateState = (promise: Partial<ExternalRequestPromise>) => {
        state.updateExternalRequest(id, { ...promise, resolve: undefined, reject: undefined });
      };

      const prom = createWithdrawStakeLedger({
        action: action,
        address: address,
        apiProp: apiProp,
        callback: callback,
        id: id,
        networkKey: networkKey,
        setState: setState,
        updateState: updateState,
        validatorAddress: validatorAddress
      });

      prom.then(() => {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        console.log(`Start withdraw-staking from ${address}`);
      })
        .catch((e) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,node/no-callback-literal,@typescript-eslint/no-unsafe-member-access
          if (!e) {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true });
          } else {
            // eslint-disable-next-line node/no-callback-literal
            callback({ txError: true, status: false });
          }

          console.error('Error withdraw-staking', e);
          setTimeout(() => {
            unsubscribe(id);
          }, 500);
        });
    } catch (e) {
      return [{ code: BasicTxErrorCode.WITHDRAW_STAKING_ERROR, message: (e as Error).message }];
    }

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
    });

    return [];
  }

  // External account request

  private rejectExternalRequest (request: RequestRejectExternalRequest): ResponseRejectExternalRequest {
    const { id, message, throwError } = request;

    const promise = state.getExternalRequest(id);

    if (promise.status === ExternalRequestPromiseStatus.PENDING && promise.reject) {
      if (throwError) {
        promise.reject(new Error(message));
      } else {
        promise.reject();
      }

      state.updateExternalRequest(id, {
        status: ExternalRequestPromiseStatus.REJECTED,
        message: message,
        reject: undefined,
        resolve: undefined
      });
    }
  }

  private resolveQrTransfer (request: RequestResolveExternalRequest): ResponseResolveExternalRequest {
    const { data, id } = request;

    const promise = state.getExternalRequest(id);

    if (promise.status === ExternalRequestPromiseStatus.PENDING) {
      promise.resolve && promise.resolve(data);
      state.updateExternalRequest(id, {
        status: ExternalRequestPromiseStatus.COMPLETED,
        reject: undefined,
        resolve: undefined
      });
    }
  }

  private subscribeConfirmations (id: string, port: chrome.runtime.Port) {
    const cb = createSubscription<'pri(confirmations.subscribe)'>(id, port);

    port.onDisconnect.addListener((): void => {
      this.cancelSubscription(id);
    });
    state.getConfirmationsQueueSubject().subscribe(cb);

    return state.getConfirmationsQueueSubject().getValue();
  }

  private completeConfirmation (request: RequestConfirmationComplete) {
    return state.completeConfirmation(request);
  }

  private getNetworkJsonByChainId (chainId?: number): NetworkJson | null {
    const networkMap = state.getNetworkMap();

    if (!chainId) {
      for (const n in networkMap) {
        if (!Object.prototype.hasOwnProperty.call(networkMap, n)) {
          continue;
        }

        const networkInfo = networkMap[n];

        if (networkInfo.isEthereum) {
          return networkInfo;
        }
      }

      return null;
    }

    for (const n in networkMap) {
      if (!Object.prototype.hasOwnProperty.call(networkMap, n)) {
        continue;
      }

      const networkInfo = networkMap[n];

      if (networkInfo.evmChainId === chainId) {
        return networkInfo;
      }
    }

    return null;
  }

  private async qrSignEVM ({ address, chainId, message, password, type }: RequestQrSignEVM): Promise<ResponseQrSignEVM> {
    let parsedPrivateKey = '';
    let signed: Web3SignedTransaction;
    const { privateKey } = this.accountExportPrivateKey({ address: address, password });

    parsedPrivateKey = privateKey.slice(2);
    const network: NetworkJson | null = this.getNetworkJsonByChainId(chainId);

    if (!network) {
      throw new Error('Cannot find network');
    }

    let web3: Web3 | null;
    let exists = false;

    const web3Api = state.getWeb3ApiMap();

    if (web3Api[network.key]) {
      web3 = web3Api[network.key];
      exists = true;
    } else {
      web3 = initWeb3Api(getCurrentProvider(network));
    }

    if (type === 'message') {
      let data = message;

      if (isHex(message)) {
        data = message;
      } else if (isAscii(message)) {
        data = `0x${message}`;
      }

      signed = web3.eth.accounts.sign(data, parsedPrivateKey);
    } else {
      const tx: QrTransaction | null = createTransactionFromRLP(message);

      if (!tx) {
        throw new Error(`Cannot create tx from ${message}`);
      }

      const txObject: TransactionConfig = {
        gasPrice: new BigN(tx.gasPrice).toNumber(),
        to: tx.action,
        value: new BigN(tx.value).toNumber(),
        data: tx.data,
        nonce: new BigN(tx.nonce).toNumber(),
        gas: new BigN(tx.gas).toNumber()
      };

      signed = await web3.eth.accounts.signTransaction(txObject, parsedPrivateKey);
    }

    if (!exists && web3.currentProvider instanceof Web3.providers.WebsocketProvider) {
      web3.currentProvider.disconnect();
      web3.setProvider(null);
      web3 = null;
    }

    return {
      signature: signatureToHex(signed)
    };
  }

  private async getChainBondingBasics (id: string, port: chrome.runtime.Port, networkJsons: NetworkJson[]) {
    const result: Record<string, ChainBondingBasics> = {};
    const callback = createSubscription<'pri(bonding.getChainBondingBasics)'>(id, port);

    await Promise.all(networkJsons.map(async (networkJson) => {
      result[networkJson.key] = await getChainBondingBasics(networkJson.key, state.getDotSamaApi(networkJson.key));
      callback(result);
    }));

    return result;
  }

  private async getBondingOption ({ address, networkKey }: BondingOptionParams): Promise<BondingOptionInfo> {
    const apiProps = state.getDotSamaApi(networkKey);
    const networkJson = state.getNetworkMapByKey(networkKey);
    const { bondedValidators,
      era,
      isBondedBefore,
      maxNominations,
      maxNominatorPerValidator,
      validatorsInfo } = await getValidatorsInfo(networkKey, apiProps, networkJson.decimals as number, address);

    return {
      maxNominatorPerValidator,
      era,
      validators: validatorsInfo,
      isBondedBefore,
      bondedValidators,
      maxNominations
    } as BondingOptionInfo;
  }

  private async getBondingTxInfo ({ amount,
    bondedValidators,
    isBondedBefore,
    lockPeriod,
    networkKey,
    nominatorAddress,
    validatorInfo }: BondingSubmitParams): Promise<BasicTxInfo> {
    const networkJson = state.getNetworkMapByKey(networkKey);

    return await getBondingTxInfo(networkJson, amount, bondedValidators, isBondedBefore, networkKey, nominatorAddress, validatorInfo, state.getDotSamaApiMap(), state.getWeb3ApiMap(), lockPeriod);
  }

  private async submitBonding (id: string, port: chrome.runtime.Port, { amount,
    bondedValidators,
    isBondedBefore,
    lockPeriod,
    networkKey,
    nominatorAddress,
    password,
    validatorInfo }: BondingSubmitParams): Promise<BasicTxResponse> {
    const txState: BasicTxResponse = {};
    const networkJson = state.getNetworkMapByKey(networkKey);

    if (!amount || !nominatorAddress || !validatorInfo || !password) {
      txState.txError = true;

      return txState;
    }

    const callback = createSubscription<'pri(bonding.submitTransaction)'>(id, port);
    const dotSamaApi = state.getDotSamaApi(networkKey);
    const extrinsic = await getBondingExtrinsic(networkJson, networkKey, amount, bondedValidators, validatorInfo, isBondedBefore, nominatorAddress, dotSamaApi, lockPeriod);
    const passwordError: string | null = unlockAccount(nominatorAddress, password);

    if (extrinsic !== null && passwordError === null) {
      const pair = keyring.getPair(nominatorAddress);

      try {
        const unsubscribe = await extrinsic.signAndSend(pair, (result) => {
          if (!result || !result.status) {
            return;
          }

          if (result.status.isInBlock || result.status.isFinalized) {
            result.events
              .filter(({ event: { section } }) => section === 'system')
              .forEach(({ event: { method } }): void => {
                txState.transactionHash = extrinsic.hash.toHex();
                callback(txState);

                if (method === 'ExtrinsicFailed') {
                  txState.status = false;
                  callback(txState);
                } else if (method === 'ExtrinsicSuccess') {
                  txState.status = true;
                  callback(txState);
                }
              });
          } else if (result.isError) {
            txState.txError = true;
            callback(txState);
          }

          if (result.isCompleted) {
            unsubscribe();
          }
        });
      } catch (e) {
        console.error('error bonding', e);
        txState.txError = true;
        callback(txState);
      }
    } else {
      txState.passwordError = passwordError;
      callback(txState);
    }

    return txState;
  }

  private async getUnbondingTxInfo ({ address,
    amount,
    networkKey,
    unstakeAll,
    validatorAddress }: UnbondingSubmitParams): Promise<BasicTxInfo> {
    const networkJson = state.getNetworkMapByKey(networkKey);

    return await getUnbondingTxInfo(address, amount, networkKey, state.getDotSamaApiMap(), state.getWeb3ApiMap(), networkJson, validatorAddress, unstakeAll);
  }

  private async submitUnbonding (id: string, port: chrome.runtime.Port, { address,
    amount,
    networkKey,
    password,
    unstakeAll,
    validatorAddress }: UnbondingSubmitParams): Promise<BasicTxResponse> {
    const txState: BasicTxResponse = {};

    if (!amount || !address || !password) {
      txState.txError = true;

      return txState;
    }

    const callback = createSubscription<'pri(unbonding.submitTransaction)'>(id, port);
    const dotSamaApi = state.getDotSamaApi(networkKey);
    const networkJson = state.getNetworkMapByKey(networkKey);
    const extrinsic = await getUnbondingExtrinsic(address, amount, networkKey, networkJson, dotSamaApi, validatorAddress, unstakeAll);
    const passwordError: string | null = unlockAccount(address, password);

    if (extrinsic !== null && passwordError === null) {
      const pair = keyring.getPair(address);

      try {
        const unsubscribe = await extrinsic.signAndSend(pair, (result) => {
          if (!result || !result.status) {
            return;
          }

          if (result.status.isInBlock || result.status.isFinalized) {
            result.events
              .filter(({ event: { section } }) => section === 'system')
              .forEach(({ event: { method } }): void => {
                txState.transactionHash = extrinsic.hash.toHex();
                callback(txState);

                if (method === 'ExtrinsicFailed') {
                  txState.status = false;
                  callback(txState);
                } else if (method === 'ExtrinsicSuccess') {
                  txState.status = true;
                  callback(txState);
                }
              });
          } else if (result.isError) {
            txState.txError = true;
            callback(txState);
          }

          if (result.isCompleted) {
            unsubscribe();
          }
        });
      } catch (e) {
        console.error('error unbonding', e);
        txState.txError = true;
        callback(txState);
      }
    } else {
      txState.passwordError = passwordError;
      callback(txState);
    }

    return txState;
  }

  private async getStakeWithdrawalTxInfo ({ action,
    address,
    networkKey,
    validatorAddress }: StakeWithdrawalParams): Promise<BasicTxInfo> {
    return await getWithdrawalTxInfo(address, networkKey, state.getNetworkMapByKey(networkKey), state.getDotSamaApiMap(), state.getWeb3ApiMap(), validatorAddress, action);
  }

  private async submitStakeWithdrawal (id: string, port: chrome.runtime.Port, { action,
    address,
    networkKey,
    password,
    validatorAddress }: StakeWithdrawalParams): Promise<BasicTxResponse> {
    const txState: BasicTxResponse = {};

    if (!address || !password) {
      txState.txError = true;

      return txState;
    }

    const callback = createSubscription<'pri(unbonding.submitWithdrawal)'>(id, port);
    const dotSamaApi = state.getDotSamaApi(networkKey);
    const extrinsic = await getWithdrawalExtrinsic(dotSamaApi, networkKey, address, validatorAddress, action);
    const passwordError: string | null = unlockAccount(address, password);

    if (extrinsic !== null && passwordError === null) {
      const pair = keyring.getPair(address);

      try {
        const unsubscribe = await extrinsic.signAndSend(pair, (result) => {
          if (!result || !result.status) {
            return;
          }

          if (result.status.isInBlock || result.status.isFinalized) {
            result.events
              .filter(({ event: { section } }) => section === 'system')
              .forEach(({ event: { method } }): void => {
                txState.transactionHash = extrinsic.hash.toHex();
                callback(txState);

                if (method === 'ExtrinsicFailed') {
                  txState.status = false;
                  callback(txState);
                } else if (method === 'ExtrinsicSuccess') {
                  txState.status = true;
                  callback(txState);
                }
              });
          } else if (result.isError) {
            txState.txError = true;
            callback(txState);
          }

          if (result.isCompleted) {
            unsubscribe();
          }
        });
      } catch (e) {
        console.error('error withdrawing', e);
        txState.txError = true;
        callback(txState);
      }
    } else {
      txState.passwordError = passwordError;
      callback(txState);
    }

    return txState;
  }

  private async getStakeClaimRewardTxInfo ({ address, networkKey }: StakeClaimRewardParams): Promise<BasicTxInfo> {
    return await getClaimRewardTxInfo(address, networkKey, state.getNetworkMapByKey(networkKey), state.getDotSamaApiMap(), state.getWeb3ApiMap());
  }

  private async submitStakeClaimReward (id: string, port: chrome.runtime.Port, { address,
    networkKey,
    password,
    validatorAddress }: StakeClaimRewardParams): Promise<BasicTxResponse> {
    const txState: BasicTxResponse = {};

    if (!address || !password) {
      txState.txError = true;

      return txState;
    }

    const callback = createSubscription<'pri(staking.submitClaimReward)'>(id, port);
    const dotSamaApi = state.getDotSamaApi(networkKey);
    const extrinsic = await getClaimRewardExtrinsic(dotSamaApi, networkKey, address, validatorAddress);
    const passwordError: string | null = unlockAccount(address, password);

    if (extrinsic !== null && passwordError === null) {
      const pair = keyring.getPair(address);

      try {
        const unsubscribe = await extrinsic.signAndSend(pair, (result) => {
          if (!result || !result.status) {
            return;
          }

          if (result.status.isInBlock || result.status.isFinalized) {
            result.events
              .filter(({ event: { section } }) => section === 'system')
              .forEach(({ event: { method } }): void => {
                txState.transactionHash = extrinsic.hash.toHex();
                callback(txState);

                if (method === 'ExtrinsicFailed') {
                  txState.status = false;
                  callback(txState);
                } else if (method === 'ExtrinsicSuccess') {
                  txState.status = true;
                  callback(txState);
                }
              });
          } else if (result.isError) {
            txState.txError = true;
            callback(txState);
          }

          if (result.isCompleted) {
            unsubscribe();
          }
        });
      } catch (e) {
        console.error('error withdrawing', e);
        txState.txError = true;
        callback(txState);
      }
    } else {
      txState.passwordError = passwordError;
      callback(txState);
    }

    return txState;
  }

  private async getStakingDelegationInfo ({ address, networkKey }: StakeDelegationRequest): Promise<DelegationItem[]> {
    const dotSamaApi = state.getDotSamaApi(networkKey);

    return await getDelegationInfo(dotSamaApi, address, networkKey);
  }

  private subscribeStakeUnlockingInfo (id: string, port: chrome.runtime.Port): StakeUnlockingJson {
    const cb = createSubscription<'pri(unbonding.subscribeUnlockingInfo)'>(id, port);
    const unlockingInfoSubscription = state.subscribeStakeUnlockingInfo().subscribe({
      next: (rs) => {
        cb(rs);
      }
    });

    port.onDisconnect.addListener((): void => {
      unsubscribe(id);
      unlockingInfoSubscription.unsubscribe();
    });

    return state.getStakeUnlockingInfo();
  }

  // EVM Transaction
  private async parseEVMTransactionInput ({ chainId,
    contract,
    data }: RequestParseEVMTransactionInput): Promise<ResponseParseEVMTransactionInput> {
    const network = this.getNetworkJsonByChainId(chainId);

    return await parseTransactionData(data, contract, network);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  public override async handle<TMessageType extends MessageTypes> (id: string, type: TMessageType, request: RequestTypes[TMessageType], port: chrome.runtime.Port): Promise<ResponseType<TMessageType>> {
    switch (type) {
      case 'pri(authorize.changeSiteAll)':
        return this.changeAuthorizationAll(request as RequestAuthorization, id, port);
      case 'pri(authorize.changeSite)':
        return this.changeAuthorization(request as RequestAuthorization, id, port);
      case 'pri(authorize.changeSitePerAccount)':
        return this.changeAuthorizationPerAcc(request as RequestAuthorizationPerAccount, id, port);
      case 'pri(authorize.changeSitePerSite)':
        return this.changeAuthorizationPerSite(request as RequestAuthorizationPerSite);
      case 'pri(authorize.changeSiteBlock)':
        return this.changeAuthorizationBlock(request as RequestAuthorizationBlock);
      case 'pri(authorize.forgetSite)':
        return this.forgetSite(request as RequestForgetSite, id, port);
      case 'pri(authorize.forgetAllSite)':
        return this.forgetAllSite(id, port);
      case 'pri(authorize.approveV2)':
        return this.authorizeApproveV2(request as RequestAuthorizeApproveV2);
      case 'pri(authorize.rejectV2)':
        return this.authorizeRejectV2(request as RequestAuthorizeReject);
      case 'pri(authorize.cancelV2)':
        return this.authorizeCancelV2(request as RequestAuthorizeCancel);
      case 'pri(authorize.requestsV2)':
        return this.authorizeSubscribeV2(id, port);
      case 'pri(authorize.listV2)':
        return this.getAuthListV2();
      case 'pri(authorize.toggle)':
        return this.toggleAuthorization2(request as string);
      case 'pri(accounts.create.suriV2)':
        return await this.accountsCreateSuriV2(request as RequestAccountCreateSuriV2);
      case 'pri(accounts.forget)':
        return await this.accountsForgetOverride(request as RequestAccountForget);
      case 'pri(accounts.create.externalV2)':
        return await this.accountsCreateExternalV2(request as RequestAccountCreateExternalV2);
      case 'pri(accounts.create.hardwareV2)':
        return await this.accountsCreateHardwareV2(request as RequestAccountCreateHardwareV2);
      case 'pri(seed.createV2)':
        return this.seedCreateV2(request as RequestSeedCreateV2);
      case 'pri(seed.validateV2)':
        return this.seedValidateV2(request as RequestSeedValidateV2);
      case 'pri(privateKey.validateV2)':
        return this.metamaskPrivateKeyValidateV2(request as RequestSeedValidateV2);
      case 'pri(accounts.exportPrivateKey)':
        return this.accountExportPrivateKey(request as RequestAccountExportPrivateKey);
      case 'pri(accounts.subscribeWithCurrentAddress)':
        return this.accountsGetAllWithCurrentAddress(id, port);
      case 'pri(accounts.subscribeAccountsInputAddress)':
        return this.accountsGetAll(id, port);
      case 'pri(accounts.saveRecent)':
        return this.saveRecentAccountId(request as RequestSaveRecentAccount);
      case 'pri(accounts.triggerSubscription)':
        return this.triggerAccountsSubscription();
      case 'pri(currentAccount.saveAddress)':
        return this.saveCurrentAccountAddress(request as RequestCurrentAccountAddress, id, port);
      case 'pri(settings.changeBalancesVisibility)':
        return this.toggleBalancesVisibility(id, port);
      case 'pri(settings.subscribe)':
        return await this.subscribeSettings(id, port);
      case 'pri(settings.saveAccountAllLogo)':
        return this.saveAccountAllLogo(request as string, id, port);
      case 'pri(settings.saveTheme)':
        return this.saveTheme(request as ThemeTypes, id, port);
      case 'pri(price.getPrice)':
        return await this.getPrice();
      case 'pri(price.getSubscription)':
        return await this.subscribePrice(id, port);
      case 'pri(balance.getBalance)':
        return this.getBalance();
      case 'pri(balance.getSubscription)':
        return this.subscribeBalance(id, port);
      case 'pri(crowdloan.getCrowdloan)':
        return this.getCrowdloan();
      case 'pri(crowdloan.getSubscription)':
        return this.subscribeCrowdloan(id, port);
      case 'pri(derivation.createV2)':
        return this.derivationCreateV2(request as RequestDeriveCreateV2);
      case 'pri(json.restoreV2)':
        return this.jsonRestoreV2(request as RequestJsonRestoreV2);
      case 'pri(json.batchRestoreV2)':
        return this.batchRestoreV2(request as RequestBatchRestoreV2);
      case 'pri(chainRegistry.getSubscription)':
        return this.subscribeChainRegistry(id, port);
      case 'pri(nft.getNft)':
        return await this.getNft();
      case 'pri(nft.getSubscription)':
        return await this.subscribeNft(id, port);
      case 'pri(nftCollection.getNftCollection)':
        return await this.getNftCollection();
      case 'pri(nftCollection.getSubscription)':
        return await this.subscribeNftCollection(id, port);
      case 'pri(staking.getStaking)':
        return this.getStaking();
      case 'pri(staking.getSubscription)':
        return this.subscribeStaking(id, port);
      case 'pri(stakingReward.getStakingReward)':
        return this.getStakingReward();
      case 'pri(stakingReward.getSubscription)':
        return this.subscribeStakingReward(id, port);
      case 'pri(transaction.history.add)':
        return this.updateTransactionHistory(request as RequestTransactionHistoryAdd, id, port);
      case 'pri(transaction.history.getSubscription)':
        return this.subscribeHistory(id, port);
      case 'pri(nft.forceUpdate)':
        return this.forceUpdateNftState(request as RequestNftForceUpdate);
      case 'pri(nftTransfer.getNftTransfer)':
        return this.getNftTransfer();
      case 'pri(nftTransfer.getSubscription)':
        return this.subscribeNftTransfer(id, port);
      case 'pri(nftTransfer.setNftTransfer)':
        return this.setNftTransfer(request as NftTransferExtra);
      case 'pri(accounts.checkTransfer)':
        return await this.checkTransfer(request as RequestCheckTransfer);
      case 'pri(accounts.transfer)':
        return await this.makeTransfer(id, port, request as RequestTransfer);
      case 'pri(accounts.checkCrossChainTransfer)':
        return await this.checkCrossChainTransfer(request as RequestCheckCrossChainTransfer);
      case 'pri(accounts.crossChainTransfer)':
        return await this.makeCrossChainTransfer(id, port, request as RequestCrossChainTransfer);
      case 'pri(evmNft.getTransaction)':
        return this.evmNftGetTransaction(request as EvmNftTransactionRequest);
      case 'pri(evmNft.submitTransaction)':
        return this.evmNftSubmitTransaction(id, port, request as EvmNftSubmitTransaction);
      case 'pri(networkMap.getSubscription)':
        return this.subscribeNetworkMap(id, port);
      case 'pri(networkMap.upsert)':
        return await this.upsertNetworkMap(request as NetworkJson);
      case 'pri(networkMap.getNetworkMap)':
        return this.getNetworkMap();
      case 'pri(networkMap.disableOne)':
        return await this.disableNetworkMap(request as string);
      case 'pri(networkMap.removeOne)':
        return this.removeNetworkMap(request as string);
      case 'pri(networkMap.enableOne)':
        return this.enableNetworkMap(request as string);
      case 'pri(apiMap.validate)':
        return await this.validateNetwork(request as ValidateNetworkRequest);
      case 'pri(networkMap.disableAll)':
        return this.disableAllNetwork();
      case 'pri(networkMap.enableAll)':
        return this.enableAllNetwork();
      case 'pri(networkMap.resetDefault)':
        return this.resetDefaultNetwork();
      case 'pri(evmTokenState.getSubscription)':
        return this.subscribeEvmTokenState(id, port);
      case 'pri(evmTokenState.getEvmTokenState)':
        return this.getEvmTokenState();
      case 'pri(evmTokenState.upsertEvmTokenState)':
        return this.upsertEvmToken(request as CustomEvmToken);
      case 'pri(evmTokenState.deleteMany)':
        return this.deleteEvmToken(request as DeleteEvmTokenParams[]);
      case 'pri(transfer.checkReferenceCount)':
        return await this.transferCheckReferenceCount(request as RequestTransferCheckReferenceCount);
      case 'pri(transfer.checkSupporting)':
        return await this.transferCheckSupporting(request as RequestTransferCheckSupporting);
      case 'pri(transfer.getExistentialDeposit)':
        return await this.transferGetExistentialDeposit(request as RequestTransferExistentialDeposit);
      case 'pri(freeBalance.subscribe)':
        return this.subscribeAddressFreeBalance(request as RequestFreeBalance, id, port);
      case 'pri(subscription.cancel)':
        return this.cancelSubscription(request as string);
      case 'pri(evmTokenState.validateEvmToken)':
        return await this.validateEvmToken(request as ValidateEvmTokenRequest);
      case 'pri(substrateNft.getTransaction)':
        return await this.substrateNftGetTransaction(request as SubstrateNftTransactionRequest);
      case 'pri(substrateNft.submitTransaction)':
        return this.substrateNftSubmitTransaction(id, port, request as SubstrateNftSubmitTransaction);
      case 'pri(networkMap.recoverDotSama)':
        return this.recoverDotSamaApi(request as string);
      case 'pri(qr.transaction.parse.substrate)':
        return this.parseSubstrateTransaction(request as RequestParseTransactionSubstrate);
      case 'pri(qr.transaction.parse.evm)':
        return await this.parseEVMTransaction(request as RequestParseTransactionEVM);
      case 'pri(qr.sign.evm)':
        return await this.qrSignEVM(request as RequestQrSignEVM);
      case 'pri(networkMap.enableMany)':
        return this.enableNetworks(request as string[]);
      case 'pri(networkMap.disableMany)':
        return await this.disableNetworks(request as string[]);
      case 'pri(accounts.get.meta)':
        return this.getAccountMeta(request as RequestAccountMeta);

      // External account qr
      case 'pri(accounts.transfer.qr.create)':
        return await this.makeTransferQR(id, port, request as RequestTransferExternal);
      case 'pri(accounts.cross.transfer.qr.create)':
        return await this.makeCrossChainTransferQr(id, port, request as RequestCrossChainTransferExternal);
      case 'pri(nft.transfer.qr.create.substrate)':
        return this.nftTransferCreateQrSubstrate(id, port, request as RequestNftTransferExternalSubstrate);
      case 'pri(nft.transfer.qr.create.evm)':
        return this.nftTransferCreateQrEvm(id, port, request as RequestNftTransferExternalEVM);
      case 'pri(stake.qr.create)':
        return this.stakeCreateQr(id, port, request as RequestStakeExternal);
      case 'pri(unStake.qr.create)':
        return this.unStakeCreateQr(id, port, request as RequestUnStakeExternal);
      case 'pri(withdrawStake.qr.create)':
        return this.withdrawStakeCreateQr(id, port, request as RequestWithdrawStakeExternal);

      // External account ledger
      case 'pri(accounts.transfer.ledger.create)':
        return await this.makeTransferLedger(id, port, request as RequestTransferExternal);
      case 'pri(accounts.cross.transfer.ledger.create)':
        return await this.makeCrossChainTransferLedger(id, port, request as RequestCrossChainTransferExternal);
      case 'pri(nft.transfer.ledger.create.substrate)':
        return this.nftTransferCreateLedgerSubstrate(id, port, request as RequestNftTransferExternalSubstrate);
      case 'pri(stake.ledger.create)':
        return this.stakeCreateLedger(id, port, request as RequestStakeExternal);
      case 'pri(unStake.ledger.create)':
        return this.unStakeCreateLedger(id, port, request as RequestUnStakeExternal);
      case 'pri(withdrawStake.ledger.create)':
        return this.withdrawStakeCreateLedger(id, port, request as RequestWithdrawStakeExternal);

      // External account request
      case 'pri(account.external.reject)':
        return this.rejectExternalRequest(request as RequestRejectExternalRequest);
      case 'pri(account.external.resolve)':
        return this.resolveQrTransfer(request as RequestResolveExternalRequest);

      case 'pri(accounts.tie)':
        return this.accountsTie2(request as RequestAccountTie);
      case 'pri(confirmations.subscribe)':
        return this.subscribeConfirmations(id, port);
      case 'pri(confirmations.complete)':
        return this.completeConfirmation(request as RequestConfirmationComplete);
      case 'pri(bonding.getBondingOptions)':
        return await this.getBondingOption(request as BondingOptionParams);
      case 'pri(bonding.getChainBondingBasics)':
        return await this.getChainBondingBasics(id, port, request as NetworkJson[]);
      case 'pri(bonding.submitTransaction)':
        return await this.submitBonding(id, port, request as BondingSubmitParams);
      case 'pri(bonding.txInfo)':
        return await this.getBondingTxInfo(request as BondingSubmitParams);
      case 'pri(unbonding.txInfo)':
        return await this.getUnbondingTxInfo(request as UnbondingSubmitParams);
      case 'pri(unbonding.submitTransaction)':
        return await this.submitUnbonding(id, port, request as UnbondingSubmitParams);
      case 'pri(unbonding.subscribeUnlockingInfo)':
        return this.subscribeStakeUnlockingInfo(id, port);
      case 'pri(unbonding.withdrawalTxInfo)':
        return await this.getStakeWithdrawalTxInfo(request as StakeWithdrawalParams);
      case 'pri(unbonding.submitWithdrawal)':
        return await this.submitStakeWithdrawal(id, port, request as StakeWithdrawalParams);
      case 'pri(staking.claimRewardTxInfo)':
        return await this.getStakeClaimRewardTxInfo(request as StakeClaimRewardParams);
      case 'pri(staking.submitClaimReward)':
        return await this.submitStakeClaimReward(id, port, request as StakeClaimRewardParams);
      case 'pri(staking.delegationInfo)':
        return await this.getStakingDelegationInfo(request as StakeDelegationRequest);
      // EVM Transaction
      case 'pri(evm.transaction.parse.input)':
        return await this.parseEVMTransactionInput(request as RequestParseEVMTransactionInput);

      // Auth Url subscribe
      case 'pri(authorize.subscribe)':
        return await this.subscribeAuthUrls(id, port);

      // Default
      default:
        return super.handle(id, type, request, port);
    }
  }
}
