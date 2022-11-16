// Copyright 2019-2022 @subwallet/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ApiProps, NetworkJson, StakingType, UnlockingStakeInfo, ValidatorInfo } from '@subwallet/extension-base/background/KoniTypes';
import { getAstarBondingBasics, getAstarBondingExtrinsic, getAstarClaimRewardExtrinsic, getAstarDappsInfo, getAstarDelegationInfo, getAstarUnbondingExtrinsic, getAstarWithdrawalExtrinsic, handleAstarBondingTxInfo, handleAstarClaimRewardTxInfo, handleAstarUnbondingTxInfo, handleAstarUnlockingInfo, handleAstarWithdrawalTxInfo } from '@subwallet/extension-koni-base/api/bonding/astar';
import { getParaBondingBasics, getParaBondingExtrinsic, getParaCollatorsInfo, getParaDelegationInfo, getParaUnbondingExtrinsic, getParaWithdrawalExtrinsic, handleParaBondingTxInfo, handleParaUnbondingTxInfo, handleParaUnlockingInfo, handleParaWithdrawalTxInfo } from '@subwallet/extension-koni-base/api/bonding/paraChain';
import { getPoolingClaimRewardExtrinsic, getRelayBondingExtrinsic, getRelayChainBondingBasics, getRelayUnbondingExtrinsic, getRelayValidatorsInfo, getRelayWithdrawalExtrinsic, getTargetValidators, handlePoolingClaimRewardTxInfo, handleRelayBondingTxInfo, handleRelayUnbondingTxInfo, handleRelayUnlockingInfo, handleRelayWithdrawalTxInfo } from '@subwallet/extension-koni-base/api/bonding/relayChain';
import Web3 from 'web3';

export const CHAIN_TYPES: Record<string, string[]> = {
  relay: ['polkadot', 'kusama', 'aleph', 'polkadex', 'ternoa', 'ternoa_alphanet', 'alephTest', 'polkadexTest', 'westend'],
  para: ['moonbeam', 'moonriver', 'moonbase', 'turing', 'turingStaging', 'bifrost', 'bifrost_testnet', 'calamari_test', 'calamari'],
  astar: ['astar', 'shiden', 'shibuya']
};

export async function getChainBondingBasics (networkKey: string, dotSamaApi: ApiProps) {
  if (CHAIN_TYPES.astar.includes(networkKey)) {
    return getAstarBondingBasics(networkKey);
  } else if (CHAIN_TYPES.para.includes(networkKey)) {
    return getParaBondingBasics(networkKey, dotSamaApi);
  }

  return getRelayChainBondingBasics(networkKey, dotSamaApi);
}

export async function getValidatorsInfo (networkKey: string, dotSamaApi: ApiProps, decimals: number, address: string) {
  if (CHAIN_TYPES.para.includes(networkKey)) {
    return getParaCollatorsInfo(networkKey, dotSamaApi, decimals, address);
  } else if (CHAIN_TYPES.astar.includes(networkKey)) {
    return getAstarDappsInfo(networkKey, dotSamaApi, decimals, address);
  }

  return getRelayValidatorsInfo(networkKey, dotSamaApi, decimals, address);
}

export async function getBondingTxInfo (networkJson: NetworkJson, amount: number, bondedValidators: string[], isBondedBefore: boolean, networkKey: string, nominatorAddress: string, validatorInfo: ValidatorInfo, dotSamaApiMap: Record<string, ApiProps>, web3ApiMap: Record<string, Web3>) {
  if (CHAIN_TYPES.para.includes(networkKey)) {
    return handleParaBondingTxInfo(networkJson, amount, networkKey, nominatorAddress, validatorInfo, dotSamaApiMap, web3ApiMap, bondedValidators.length);
  } else if (CHAIN_TYPES.astar.includes(networkKey)) {
    return handleAstarBondingTxInfo(networkJson, amount, networkKey, nominatorAddress, validatorInfo, dotSamaApiMap, web3ApiMap);
  }

  const targetValidators: string[] = getTargetValidators(bondedValidators, validatorInfo.address);

  return handleRelayBondingTxInfo(networkJson, amount, targetValidators, isBondedBefore, networkKey, nominatorAddress, dotSamaApiMap, web3ApiMap);
}

export async function getBondingExtrinsic (networkJson: NetworkJson, networkKey: string, amount: number, bondedValidators: string[], validatorInfo: ValidatorInfo, isBondedBefore: boolean, nominatorAddress: string, dotSamaApi: ApiProps) {
  if (CHAIN_TYPES.para.includes(networkKey)) {
    return getParaBondingExtrinsic(nominatorAddress, networkJson, dotSamaApi, amount, validatorInfo, bondedValidators.length);
  } else if (CHAIN_TYPES.astar.includes(networkKey)) {
    return getAstarBondingExtrinsic(dotSamaApi, networkJson, amount, networkKey, nominatorAddress, validatorInfo);
  }

  const targetValidators: string[] = getTargetValidators(bondedValidators, validatorInfo.address);

  return getRelayBondingExtrinsic(dotSamaApi, nominatorAddress, amount, targetValidators, isBondedBefore, networkJson);
}

export async function getUnbondingTxInfo (address: string, amount: number, networkKey: string, dotSamaApiMap: Record<string, ApiProps>, web3ApiMap: Record<string, Web3>, networkJson: NetworkJson, validatorAddress?: string, unstakeAll?: boolean) {
  if (CHAIN_TYPES.para.includes(networkKey)) {
    return handleParaUnbondingTxInfo(address, amount, networkKey, dotSamaApiMap, web3ApiMap, networkJson, validatorAddress as string, unstakeAll as boolean);
  } else if (CHAIN_TYPES.astar.includes(networkKey)) {
    return handleAstarUnbondingTxInfo(networkJson, amount, networkKey, address, validatorAddress as string, dotSamaApiMap, web3ApiMap);
  }

  return handleRelayUnbondingTxInfo(address, amount, networkKey, dotSamaApiMap, web3ApiMap, networkJson);
}

export async function getUnbondingExtrinsic (address: string, amount: number, networkKey: string, networkJson: NetworkJson, dotSamaApi: ApiProps, validatorAddress?: string, unstakeAll?: boolean) {
  if (CHAIN_TYPES.para.includes(networkKey)) {
    return getParaUnbondingExtrinsic(dotSamaApi, amount, networkJson, validatorAddress as string, unstakeAll as boolean);
  } else if (CHAIN_TYPES.astar.includes(networkKey)) {
    return getAstarUnbondingExtrinsic(dotSamaApi, networkJson, amount, networkKey, address, validatorAddress as string);
  }

  return getRelayUnbondingExtrinsic(dotSamaApi, amount, networkJson);
}

export async function getUnlockingInfo (dotSamaApi: ApiProps, networkJson: NetworkJson, networkKey: string, address: string, type: StakingType): Promise<UnlockingStakeInfo> {
  if (CHAIN_TYPES.para.includes(networkKey)) {
    return handleParaUnlockingInfo(dotSamaApi, networkJson, networkKey, address, type);
  } else if (CHAIN_TYPES.astar.includes(networkKey)) {
    return handleAstarUnlockingInfo(dotSamaApi, networkJson, networkKey, address, type);
  }

  return handleRelayUnlockingInfo(dotSamaApi, networkJson, networkKey, address, type);
}

export async function getWithdrawalTxInfo (address: string, networkKey: string, networkJson: NetworkJson, dotSamaApiMap: Record<string, ApiProps>, web3ApiMap: Record<string, Web3>, validatorAddress?: string, action?: string) {
  if (CHAIN_TYPES.para.includes(networkKey)) {
    return handleParaWithdrawalTxInfo(networkKey, networkJson, dotSamaApiMap, web3ApiMap, address, validatorAddress as string, action as string);
  } else if (CHAIN_TYPES.astar.includes(networkKey)) {
    return handleAstarWithdrawalTxInfo(networkKey, networkJson, dotSamaApiMap, web3ApiMap, address);
  }

  return handleRelayWithdrawalTxInfo(address, networkKey, networkJson, dotSamaApiMap, web3ApiMap);
}

export async function getWithdrawalExtrinsic (dotSamaApi: ApiProps, networkKey: string, address: string, validatorAddress?: string, action?: string) {
  if (CHAIN_TYPES.para.includes(networkKey)) {
    return getParaWithdrawalExtrinsic(dotSamaApi, address, validatorAddress as string, action as string);
  } else if (CHAIN_TYPES.astar.includes(networkKey)) {
    return getAstarWithdrawalExtrinsic(dotSamaApi);
  }

  return getRelayWithdrawalExtrinsic(dotSamaApi, address);
}

export async function getClaimRewardTxInfo (address: string, networkKey: string, networkJson: NetworkJson, dotSamaApiMap: Record<string, ApiProps>, web3ApiMap: Record<string, Web3>, stakingType: StakingType) {
  if (stakingType === StakingType.POOLED) {
    return handlePoolingClaimRewardTxInfo(address, networkKey, networkJson, dotSamaApiMap, web3ApiMap);
  }

  return handleAstarClaimRewardTxInfo(address, networkKey, networkJson, dotSamaApiMap, web3ApiMap);
}

export async function getClaimRewardExtrinsic (dotSamaApi: ApiProps, networkKey: string, address: string, stakingType: StakingType, validatorAddress?: string) {
  if (stakingType === StakingType.POOLED) {
    return getPoolingClaimRewardExtrinsic(dotSamaApi);
  }

  return getAstarClaimRewardExtrinsic(dotSamaApi, validatorAddress as string, address);
}

export async function getDelegationInfo (dotSamaApi: ApiProps, address: string, networkKey: string) {
  if (CHAIN_TYPES.para.includes(networkKey)) {
    return getParaDelegationInfo(dotSamaApi, address, networkKey);
  }

  return getAstarDelegationInfo(dotSamaApi, address, networkKey);
}
