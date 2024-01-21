// Copyright 2019-2022 @subwallet/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { _ChainInfo } from '@subwallet/chain-list/types';
import { AmountData, ExtrinsicType, NominationInfo } from '@subwallet/extension-base/background/KoniTypes';
import { AccountJson } from '@subwallet/extension-base/background/types';
import { getValidatorLabel } from '@subwallet/extension-base/koni/api/staking/bonding/utils';
import { isActionFromValidator } from '@subwallet/extension-base/services/earning-service/utils';
import { RequestYieldLeave, YieldPoolType, YieldPositionInfo } from '@subwallet/extension-base/types';
import { AccountSelector, AmountInput, HiddenInput, NominationSelector } from '@subwallet/extension-koni-ui/components';
import { getInputValuesFromString } from '@subwallet/extension-koni-ui/components/Field/AmountInput';
import { BN_ZERO } from '@subwallet/extension-koni-ui/constants';
import { useGetBalance, useHandleSubmitTransaction, useInitValidateTransaction, usePreCheckAction, useRestoreTransaction, useSelector, useTransactionContext, useWatchTransaction } from '@subwallet/extension-koni-ui/hooks';
import { useYieldPositionDetail } from '@subwallet/extension-koni-ui/hooks/earning';
import { yieldSubmitLeavePool } from '@subwallet/extension-koni-ui/messaging';
import { FormCallbacks, FormFieldData, ThemeProps, UnStakeParams } from '@subwallet/extension-koni-ui/types';
import { convertFieldToObject, noop, simpleCheckForm } from '@subwallet/extension-koni-ui/utils';
import { Button, Form, Icon } from '@subwallet/react-ui';
import BigN from 'bignumber.js';
import CN from 'classnames';
import { MinusCircle } from 'phosphor-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

import useGetChainAssetInfo from '../../../hooks/screen/common/useGetChainAssetInfo';
import { accountFilterFunc } from '../helper';
import { BondedBalance, EarnOutlet, FreeBalance, TransactionContent, TransactionFooter } from '../parts';

type Props = ThemeProps;

const filterAccount = (
  positionInfos: YieldPositionInfo[],
  chainInfoMap: Record<string, _ChainInfo>,
  poolType: YieldPoolType,
  poolChain?: string
): ((account: AccountJson) => boolean) => {
  return (account: AccountJson): boolean => {
    const nominator = positionInfos.find((item) => item.address.toLowerCase() === account.address.toLowerCase());

    return (
      new BigN(nominator?.activeStake || BN_ZERO).gt(BN_ZERO) &&
      accountFilterFunc(chainInfoMap, poolType, poolChain)(account)
    );
  };
};

const hideFields: Array<keyof UnStakeParams> = ['chain', 'asset', 'slug'];
const validateFields: Array<keyof UnStakeParams> = ['value'];

const Component: React.FC = () => {
  const { t } = useTranslation();

  const { defaultData, onDone, persistData } = useTransactionContext<UnStakeParams>();
  const { slug } = defaultData;

  const { accounts, isAllAccount } = useSelector((state) => state.accountState);
  const chainInfoMap = useSelector((state) => state.chainStore.chainInfoMap);
  const { assetRegistry } = useSelector((state) => state.assetRegistry);
  const { poolInfoMap } = useSelector((state) => state.earning);
  const poolInfo = poolInfoMap[slug];
  const poolType = poolInfo.type;
  const poolChain = poolInfo.chain;

  const [form] = Form.useForm<UnStakeParams>();
  const [isBalanceReady, setIsBalanceReady] = useState(true);
  const [amountChange, setAmountChange] = useState(false);

  const formDefault = useMemo((): UnStakeParams => ({
    ...defaultData
  }), [defaultData]);

  const fromValue = useWatchTransaction('from', form, defaultData);
  const currentValidator = useWatchTransaction('validator', form, defaultData);
  const chainValue = useWatchTransaction('chain', form, defaultData);

  const { list: allPositions } = useYieldPositionDetail(slug);
  const { compound: positionInfo } = useYieldPositionDetail(slug, fromValue);

  const bondedSlug = useMemo(() => {
    switch (poolInfo.type) {
      case YieldPoolType.LIQUID_STAKING:
        return poolInfo.metadata.derivativeAssets[0];
      case YieldPoolType.LENDING:
      case YieldPoolType.NATIVE_STAKING:
      case YieldPoolType.NOMINATION_POOL:
      default:
        return poolInfo.metadata.inputAsset;
    }
  }, [poolInfo]);

  const bondedAsset = useGetChainAssetInfo(bondedSlug || poolInfo.metadata.inputAsset);
  const decimals = bondedAsset?.decimals || 0;
  const symbol = bondedAsset?.symbol || '';

  const selectedValidator = useMemo((): NominationInfo | undefined => {
    if (positionInfo) {
      return positionInfo.nominations.find((item) => item.validatorAddress === currentValidator);
    } else {
      return undefined;
    }
  }, [currentValidator, positionInfo]);

  const { nativeTokenBalance } = useGetBalance(chainValue, fromValue);
  const existentialDeposit = useMemo(() => {
    const assetInfo = Object.values(assetRegistry).find((v) => v.originChain === chainValue);

    if (assetInfo) {
      return assetInfo.minAmount || '0';
    }

    return '0';
  }, [assetRegistry, chainValue]);

  // @ts-ignore
  const showFastLeave = useMemo(() => {
    return poolInfo.metadata.availableMethod.defaultUnstake && poolInfo.metadata.availableMethod.fastUnstake;
  }, [poolInfo.metadata]);

  const mustChooseValidator = useMemo(() => {
    return isActionFromValidator(poolType, poolChain || '');
  }, [poolChain, poolType]);

  const bondedValue = useMemo((): string => {
    switch (poolInfo.type) {
      case YieldPoolType.NATIVE_STAKING:
        if (!mustChooseValidator) {
          return positionInfo?.activeStake || '0';
        } else {
          return selectedValidator?.activeStake || '0';
        }

      case YieldPoolType.LENDING: {
        const input = poolInfo.metadata.inputAsset;
        const exchaneRate = poolInfo.statistic?.assetEarning.find((item) => item.slug === input)?.exchangeRate || 1;

        return new BigN(positionInfo?.activeStake || '0').multipliedBy(exchaneRate).toFixed(0);
      }

      case YieldPoolType.LIQUID_STAKING:
      case YieldPoolType.NOMINATION_POOL:
      default:
        return positionInfo?.activeStake || '0';
    }
  }, [mustChooseValidator, poolInfo.metadata.inputAsset, poolInfo.statistic?.assetEarning, poolInfo.type, positionInfo?.activeStake, selectedValidator?.activeStake]);

  const [isChangeData, setIsChangeData] = useState(false);

  const persistValidator = useMemo(() => {
    if (fromValue === defaultData.from && !isChangeData) {
      return defaultData.validator;
    } else {
      return '';
    }
  }, [defaultData.from, defaultData.validator, fromValue, isChangeData]);

  const unBondedTime = useMemo((): string => {
    if (
      poolInfo.statistic &&
      'unstakingPeriod' in poolInfo.statistic &&
      poolInfo.statistic.unstakingPeriod !== undefined
    ) {
      const time = poolInfo.statistic.unstakingPeriod;

      if (time >= 24) {
        const days = Math.floor(time / 24);
        const hours = time - days * 24;

        return `${days} ${t('days')}${hours ? ` ${hours} ${t('hours')}` : ''}`;
      } else {
        return `${time} ${t('hours')}`;
      }
    } else {
      return t('unknown time');
    }
  }, [poolInfo.statistic, t]);

  // @ts-ignore
  const handleDataForInsufficientAlert = useCallback(
    (estimateFee: AmountData) => {
      return {
        existentialDeposit: getInputValuesFromString(existentialDeposit, estimateFee.decimals),
        availableBalance: getInputValuesFromString(nativeTokenBalance.value, estimateFee.decimals),
        maintainBalance: getInputValuesFromString(poolInfo.metadata.maintainBalance || '0', estimateFee.decimals),
        symbol: estimateFee.symbol
      };
    },
    [existentialDeposit, nativeTokenBalance.value, poolInfo.metadata.maintainBalance]
  );

  const [loading, setLoading] = useState(false);
  const [isDisable, setIsDisable] = useState(true);
  const { onError, onSuccess } = useHandleSubmitTransaction(onDone);

  const onValuesChange: FormCallbacks<UnStakeParams>['onValuesChange'] = useCallback((changes: Partial<UnStakeParams>, values: UnStakeParams) => {
    const { from, validator, value } = changes;

    if (from) {
      setIsChangeData(true);
    }

    if ((from || validator) && (amountChange || defaultData.value)) {
      form.validateFields(['value']).finally(noop);
    }

    if (value !== undefined) {
      setAmountChange(true);
    }
  }, [amountChange, form, defaultData.value]);

  const onFieldsChange: FormCallbacks<UnStakeParams>['onFieldsChange'] = useCallback((changedFields: FormFieldData[], allFields: FormFieldData[]) => {
    // TODO: field change
    const { error } = simpleCheckForm(allFields);

    const allMap = convertFieldToObject<UnStakeParams>(allFields);

    const checkEmpty: Record<string, boolean> = {};

    for (const [key, value] of Object.entries(allMap)) {
      checkEmpty[key] = !!value;
    }

    checkEmpty.asset = true;

    if (!mustChooseValidator) {
      checkEmpty.validator = true;
    }

    setIsDisable(error || Object.values(checkEmpty).some((value) => !value));
    persistData(form.getFieldsValue());
  }, [form, mustChooseValidator, persistData]);

  const onSubmit: FormCallbacks<UnStakeParams>['onFinish'] = useCallback((values: UnStakeParams) => {
    if (!positionInfo) {
      return;
    }

    const { fastLeave, from, slug, value } = values;

    const request: RequestYieldLeave = {
      address: from,
      amount: value,
      fastLeave,
      slug,
      poolInfo: poolInfo
    };

    if (mustChooseValidator) {
      request.selectedTarget = currentValidator || '';
    }

    const unbondingPromise = yieldSubmitLeavePool(request);

    setLoading(true);

    setTimeout(() => {
      unbondingPromise
        .then(onSuccess)
        .catch(onError)
        .finally(() => {
          setLoading(false);
        });
    }, 300);
  }, [currentValidator, mustChooseValidator, onError, onSuccess, poolInfo, positionInfo]);

  const renderBounded = useCallback(() => {
    return (
      <BondedBalance
        bondedBalance={bondedValue}
        className={'bonded-balance'}
        decimals={decimals}
        symbol={symbol}
      />
    );
  }, [bondedValue, decimals, symbol]);

  const onPreCheck = usePreCheckAction(fromValue);

  useRestoreTransaction(form);
  useInitValidateTransaction(validateFields, form, defaultData);

  const accountList = useMemo(() => {
    return accounts.filter(filterAccount(allPositions, chainInfoMap, poolType, poolChain));
  }, [accounts, allPositions, chainInfoMap, poolChain, poolType]);

  const nominators = useMemo(() => {
    if (fromValue && positionInfo?.nominations && positionInfo.nominations.length) {
      return positionInfo.nominations.filter((n) => new BigN(n.activeStake || '0').gt(BN_ZERO));
    }

    return [];
  }, [fromValue, positionInfo?.nominations]);

  useEffect(() => {
    if (poolInfo.metadata.availableMethod.defaultUnstake && poolInfo.metadata.availableMethod.fastUnstake) {
      //
    } else {
      if (poolInfo.metadata.availableMethod.defaultUnstake) {
        form.setFieldValue('fastLeave', false);
      } else {
        form.setFieldValue('fastLeave', true);
      }
    }
  }, [form, poolInfo.metadata]);

  useEffect(() => {
    form.setFieldValue('chain', poolChain || '');
  }, [poolChain, form]);

  useEffect(() => {
    if (!fromValue && accountList.length === 1) {
      form.setFieldValue('from', accountList[0].address);
    }
  }, [accountList, form, fromValue]);

  return (
    <>
      <TransactionContent>
        <Form
          className={CN('form-container', 'form-space-xxs')}
          form={form}
          initialValues={formDefault}
          name='unstake-form'
          onFieldsChange={onFieldsChange}
          onFinish={onSubmit}
          onValuesChange={onValuesChange}
        >
          <HiddenInput fields={hideFields} />
          <Form.Item
            name={'from'}
          >
            <AccountSelector
              disabled={!isAllAccount}
              doFilter={false}
              externalAccounts={accountList}
              label={t('Unstake from account')}
            />
          </Form.Item>
          <FreeBalance
            address={fromValue}
            chain={chainValue}
            className={'free-balance'}
            label={t('Available balance:')}
            onBalanceReady={setIsBalanceReady}
          />

          <Form.Item
            hidden={!mustChooseValidator}
            name={'validator'}
          >
            <NominationSelector
              chain={chainValue}
              defaultValue={persistValidator}
              disabled={!fromValue}
              label={t(`Select ${getValidatorLabel(chainValue)}`)}
              nominators={nominators}
            />
          </Form.Item>

          {
            mustChooseValidator && (
              <>
                {renderBounded()}
              </>
            )
          }

          <Form.Item
            name={'value'}
            statusHelpAsTooltip={true}
          >
            <AmountInput
              decimals={decimals}
              maxValue={bondedValue}
              showMaxButton={true}
            />
          </Form.Item>

          {!mustChooseValidator && renderBounded()}

          {/* todo: fast Lease checkbox */}
          {/* todo: instruction items here */}
          {/* todo: clear unused code in this area */}

          <div className={CN('text-light-4', { mt: mustChooseValidator })}>
            {
              t(
                'Once unbonded, your funds would be available for withdrawal after {{time}}.',
                {
                  replace:
                      {
                        time: unBondedTime
                      }
                }
              )
            }
          </div>
        </Form>
      </TransactionContent>
      <TransactionFooter>
        {/* todo: recheck action type, it may not work as expected any more */}
        <Button
          disabled={isDisable || !isBalanceReady}
          icon={(
            <Icon
              phosphorIcon={MinusCircle}
              weight={'fill'}
            />
          )}
          loading={loading}
          onClick={onPreCheck(form.submit, poolInfo.type === YieldPoolType.NOMINATION_POOL ? ExtrinsicType.STAKING_LEAVE_POOL : ExtrinsicType.STAKING_UNBOND)}
        >
          {poolInfo.type === YieldPoolType.LENDING ? t('Withdraw') : t('Unbond')}
        </Button>
      </TransactionFooter>
    </>
  );
};

const Wrapper: React.FC<Props> = (props: Props) => {
  const { className } = props;

  return (
    <EarnOutlet
      className={CN(className)}
      path={'/transaction/unstake'}
      stores={['earning']}
    >
      <Component />
    </EarnOutlet>
  );
};

const Unbond = styled(Wrapper)<Props>(({ theme: { token } }: Props) => {
  return {
    '&.page-wrapper': {
      display: 'flex',
      flexDirection: 'column'
    },

    '.bonded-balance, .free-balance': {
      marginBottom: token.margin
    },

    '.meta-info': {
      marginTop: token.paddingSM
    },

    '.mt': {
      marginTop: token.marginSM
    }
  };
});

export default Unbond;
