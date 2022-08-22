// Copyright 2019-2022 @subwallet/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { faCircleCheck, faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ValidatorInfo } from '@subwallet/extension-base/background/KoniTypes';
import TrophyGreen from '@subwallet/extension-koni-ui/assets/trophy-green.svg';
import { ActionContext } from '@subwallet/extension-koni-ui/components';
import Button from '@subwallet/extension-koni-ui/components/Button';
import Identicon from '@subwallet/extension-koni-ui/components/Identicon';
import Tooltip from '@subwallet/extension-koni-ui/components/Tooltip';
import useIsSufficientBalance from '@subwallet/extension-koni-ui/hooks/screen/bonding/useIsSufficientBalance';
import useGetNetworkJson from '@subwallet/extension-koni-ui/hooks/screen/home/useGetNetworkJson';
import useToast from '@subwallet/extension-koni-ui/hooks/useToast';
import { getStakeUnit, parseBalanceString } from '@subwallet/extension-koni-ui/Popup/Bonding/utils';
import { RootState, store } from '@subwallet/extension-koni-ui/stores';
import { BondingParams } from '@subwallet/extension-koni-ui/stores/types';
import { ThemeProps } from '@subwallet/extension-koni-ui/types';
import { toShort } from '@subwallet/extension-koni-ui/util';
import React, { useCallback, useContext, useState } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

import { isEthereumAddress } from '@polkadot/util-crypto';

interface Props extends ThemeProps {
  className?: string;
  validatorInfo: ValidatorInfo,
  networkKey: string,
  maxNominatorPerValidator: number,
  isBondedBefore: boolean,
  bondedValidators: string[],
  maxNominations: number
}

function checkCurrentlyBonded (bondedValidators: string[], validatorAddress: string) {
  let isBonded = false;

  bondedValidators.forEach((bondedValidator) => {
    if (bondedValidator.toLowerCase() === validatorAddress.toLowerCase()) {
      isBonded = true;
    }
  });

  return isBonded;
}

function ValidatorItem ({ bondedValidators, className, isBondedBefore, maxNominations, maxNominatorPerValidator, networkKey, validatorInfo }: Props): React.ReactElement<Props> {
  const networkJson = useGetNetworkJson(networkKey);
  const [showDetail, setShowDetail] = useState(false);
  const { show } = useToast();
  const { currentAccount: { account } } = useSelector((state: RootState) => state);

  const isCurrentlyBonded = checkCurrentlyBonded(bondedValidators, validatorInfo.address);
  const isOversubscribed = validatorInfo.nominatorCount >= maxNominatorPerValidator;
  const isSufficientFund = useIsSufficientBalance(networkKey, validatorInfo.minBond);
  const hasOwnStake = validatorInfo.ownStake > 0;
  const isMaxCommission = validatorInfo.commission === 100;
  const unit = getStakeUnit(networkKey, networkJson);

  const navigate = useContext(ActionContext);

  const handleOnClick = useCallback(() => {
    setShowDetail(!showDetail);
  }, [showDetail]);

  const getMinBondTooltipText = useCallback(() => {
    return `Your free balance needs to be at least ${parseBalanceString(validatorInfo.minBond, networkJson.nativeToken as string)}.`;
  }, [networkJson.nativeToken, validatorInfo.minBond]);

  const handleOnSelect = useCallback(() => {
    if (validatorInfo.hasScheduledRequest) {
      show('Please withdraw the unstaking amount first');

      return;
    }

    if (!isSufficientFund && !isCurrentlyBonded) {
      show('Your free balance is not enough to stake');

      return;
    }

    if (bondedValidators.length >= maxNominations && !bondedValidators.includes(validatorInfo.address)) {
      show('Please choose among the nominating validators only');

      return;
    }

    store.dispatch({ type: 'bondingParams/update', payload: { selectedAccount: account?.address as string, selectedNetwork: networkKey, selectedValidator: validatorInfo, maxNominatorPerValidator, isBondedBefore, bondedValidators } as BondingParams });
    navigate('/account/bonding-auth');
  }, [account?.address, bondedValidators, isBondedBefore, isCurrentlyBonded, isSufficientFund, maxNominations, maxNominatorPerValidator, navigate, networkKey, show, validatorInfo]);

  const handleGetValidatorDetail = useCallback(() => {
    if (['astar', 'shiden', 'shibuya'].includes(networkKey)) {
      return (
        <div className={'validator-detail-container'}>
          <div className={'validator-att-container'}>
            <div className={'validator-att'}>
              <div className={'validator-att-title'}>Total stake</div>
              <div className={'validator-att-value'}>{parseBalanceString(validatorInfo.totalStake, unit)}</div>
            </div>

            <div className={'validator-att'}>
              <div className={'validator-att-title'}>
                Stakers count
                {
                  isOversubscribed && <FontAwesomeIcon
                    className={'error-tooltip'}
                    data-for={`validator-oversubscribed-tooltip-${networkKey}`}
                    data-tip={true}
                    icon={faCircleExclamation}
                  />
                }
                <Tooltip
                  place={'top'}
                  // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                  text={'Oversubscribed. You will not be able to receive reward.'}
                  trigger={`validator-oversubscribed-tooltip-${networkKey}`}
                />
              </div>
              <div className={`${!isOversubscribed ? 'validator-att-value' : 'validator-att-value-error'}`}>{validatorInfo.nominatorCount}</div>
            </div>
          </div>

          <div className={'validator-att-container'}>
            <div className={'validator-att'}>
              <div className={'validator-att-title'}>
                Minimum stake
                {
                  !isSufficientFund && !isCurrentlyBonded && <FontAwesomeIcon
                    className={'error-tooltip'}
                    data-for={`insufficient-fund-tooltip-${networkKey}`}
                    data-tip={true}
                    icon={faCircleExclamation}
                  />
                }
                <Tooltip
                  place={'top'}
                  // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                  text={getMinBondTooltipText()}
                  trigger={`insufficient-fund-tooltip-${networkKey}`}
                />
              </div>
              <div className={`${isSufficientFund || isCurrentlyBonded ? 'validator-att-value' : 'validator-att-value-error'}`}>{parseBalanceString(validatorInfo.minBond, networkJson.nativeToken as string)}</div>
            </div>
          </div>

          {/* { */}
          {/*  validatorInfo.commission !== undefined && <div className={'validator-att-container'}> */}
          {/*    <div className={'validator-att'}> */}
          {/*      <div className={'validator-att-title'}> */}
          {/*        Commission */}
          {/*        { */}
          {/*          isMaxCommission && <FontAwesomeIcon */}
          {/*            className={'error-tooltip'} */}
          {/*            data-for={`commission-max-tooltip-${networkKey}`} */}
          {/*            data-tip={true} */}
          {/*            icon={faCircleExclamation} */}
          {/*          /> */}
          {/*        } */}
          {/*        <Tooltip */}
          {/*          place={'top'} */}
          {/*          text={'You will not be able to receive reward.'} */}
          {/*          trigger={`commission-max-tooltip-${networkKey}`} */}
          {/*        /> */}
          {/*      </div> */}
          {/*      <div className={`${!isMaxCommission ? 'validator-att-value' : 'validator-att-value-error'}`}>{validatorInfo.commission}%</div> */}
          {/*    </div> */}
          {/*  </div> */}
          {/* } */}

          <Button
            className={'staking-button'}
            onClick={handleOnSelect}
          >
            Start staking
          </Button>
        </div>
      );
    } else {
      return (
        <div className={'validator-detail-container'}>
          <div className={'validator-att-container'}>
            <div className={'validator-att'}>
              <div className={'validator-att-title'}>Total stake</div>
              <div className={'validator-att-value'}>{parseBalanceString(validatorInfo.totalStake, unit)}</div>
            </div>

            <div className={'validator-att'}>
              <div className={'validator-att-title'}>
                Own stake
                {
                  !hasOwnStake && <FontAwesomeIcon
                    className={'warning-tooltip'}
                    data-for={`validator-has-no-stake-tooltip-${networkKey}`}
                    data-tip={true}
                    icon={faCircleExclamation}
                  />
                }
                <Tooltip
                  place={'top'}
                  // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                  text={'Validators should have their own stake.'}
                  trigger={`validator-has-no-stake-tooltip-${networkKey}`}
                />
              </div>
              <div className={`${hasOwnStake ? 'validator-att-value' : 'validator-att-value-warning'}`}>{parseBalanceString(validatorInfo.ownStake, unit)}</div>
            </div>
          </div>

          <div className={'validator-att-container'}>
            <div className={'validator-att'}>
              <div className={'validator-att-title'}>
                Nominators count
                {
                  isOversubscribed && <FontAwesomeIcon
                    className={'error-tooltip'}
                    data-for={`validator-oversubscribed-tooltip-${networkKey}`}
                    data-tip={true}
                    icon={faCircleExclamation}
                  />
                }
                <Tooltip
                  place={'top'}
                  // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                  text={'Oversubscribed. You will not be able to receive reward.'}
                  trigger={`validator-oversubscribed-tooltip-${networkKey}`}
                />
              </div>
              <div className={`${!isOversubscribed ? 'validator-att-value' : 'validator-att-value-error'}`}>{validatorInfo.nominatorCount}</div>
            </div>

            <div className={'validator-att'}>
              <div className={'validator-att-title'}>
                Minimum stake
                {
                  !isSufficientFund && !isCurrentlyBonded && <FontAwesomeIcon
                    className={'error-tooltip'}
                    data-for={`insufficient-fund-tooltip-${networkKey}`}
                    data-tip={true}
                    icon={faCircleExclamation}
                  />
                }
                <Tooltip
                  place={'top'}
                  // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
                  text={getMinBondTooltipText()}
                  trigger={`insufficient-fund-tooltip-${networkKey}`}
                />
              </div>
              <div className={`${isSufficientFund || isCurrentlyBonded ? 'validator-att-value' : 'validator-att-value-error'}`}>{parseBalanceString(validatorInfo.minBond, networkJson.nativeToken as string)}</div>
            </div>
          </div>

          {
            validatorInfo.commission !== undefined && <div className={'validator-att-container'}>
              <div className={'validator-att'}>
                <div className={'validator-att-title'}>
                  Commission
                  {
                    isMaxCommission && <FontAwesomeIcon
                      className={'error-tooltip'}
                      data-for={`commission-max-tooltip-${networkKey}`}
                      data-tip={true}
                      icon={faCircleExclamation}
                    />
                  }
                  <Tooltip
                    place={'top'}
                    text={'You will not be able to receive reward.'}
                    trigger={`commission-max-tooltip-${networkKey}`}
                  />
                </div>
                <div className={`${!isMaxCommission ? 'validator-att-value' : 'validator-att-value-error'}`}>{validatorInfo.commission}%</div>
              </div>
            </div>
          }

          <Button
            className={'staking-button'}
            onClick={handleOnSelect}
          >
            Start staking
          </Button>
        </div>
      );
    }
  }, [getMinBondTooltipText, handleOnSelect, hasOwnStake, isCurrentlyBonded, isMaxCommission, isOversubscribed, isSufficientFund, networkJson.nativeToken, networkKey, unit, validatorInfo.commission, validatorInfo.minBond, validatorInfo.nominatorCount, validatorInfo.ownStake, validatorInfo.totalStake]);

  return (
    <div className={className}>
      <div
        className={'validator-item-container'}
        onClick={handleOnClick}
      >
        <div className={'validator-header'}>
          {
            validatorInfo.icon
              ? <img
                className='imgIcon'
                height={28}
                src={validatorInfo.icon}
                width={28}
              />
              : <Identicon
                className='identityIcon'
                genesisHash={networkJson.genesisHash}
                iconTheme={isEthereumAddress(validatorInfo.address) ? 'ethereum' : 'substrate'}
                prefix={networkJson.ss58Format}
                size={20}
                value={validatorInfo.address}
              />
          }

          <div
            data-for={`identity-tooltip-${validatorInfo.address}`}
            data-tip={true}
          >
            {validatorInfo.identity ? validatorInfo.identity : toShort(validatorInfo.address)}
          </div>
          {
            validatorInfo.identity && <Tooltip
              place={'top'}
              text={toShort(validatorInfo.address)}
              trigger={`identity-tooltip-${validatorInfo.address}`}
            />
          }
          {
            validatorInfo.isVerified && <FontAwesomeIcon
              className={'validator-verified'}
              data-for={`verify-tooltip-${validatorInfo.address}`}
              data-tip={true}
              icon={faCircleCheck}
            />
          }
          {
            validatorInfo.isVerified && <Tooltip
              place={'top'}
              text={'Verified'}
              trigger={`verify-tooltip-${validatorInfo.address}`}
            />
          }

          {
            validatorInfo.isNominated && <img
              data-for={`nominated-tooltip-${validatorInfo.address}`}
              data-tip={true}
              height={15}
              src={TrophyGreen}
              width={15}
            />
          }
          {
            validatorInfo.isNominated && <Tooltip
              place={'top'}
              text={'Nominating'}
              trigger={`nominated-tooltip-${validatorInfo.address}`}
            />
          }
        </div>

        <div className={'validator-footer'}>
          {
            validatorInfo.expectedReturn > 0 && <div
              className={'validator-expected-return'}
              data-for={`validator-return-tooltip-${validatorInfo.address}`}
              data-tip={true}
            >
              {validatorInfo.expectedReturn.toFixed(1)}%
            </div>
          }

          <Tooltip
            place={'top'}
            text={'Expected return'}
            trigger={`validator-return-tooltip-${validatorInfo.address}`}
          />

          <div className={'validator-item-toggle-container'}>
            <div
              className={'validator-item-toggle'}
              style={{ transform: showDetail ? 'rotate(45deg)' : 'rotate(-45deg)' }}
            />
          </div>
        </div>
      </div>

      {
        showDetail && handleGetValidatorDetail()
      }
    </div>
  );
}

export default React.memo(styled(ValidatorItem)(({ theme }: Props) => `
  background: ${theme.accountAuthorizeRequest};
  border-radius: 8px;
  .imgIcon {
    border-radius: 50%;
  }
  .warning-tooltip {
    color: ${theme.iconWarningColor};
    font-size: 12px;
  }
  .error-tooltip {
    color: ${theme.errorColor};
    font-size: 12px;
  }
  .validator-verified {
    color: ${theme.textColor3};
    font-size: 12px;
  }
  .validator-att-title {
    color: ${theme.textColor2};
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .validator-att-value {
    color: ${theme.textColor3};
    font-size: 14px;
  }
  .validator-att-value-error {
    color: ${theme.errorColor};
    font-size: 14px;
  }
  .validator-att-value-warning {
    color: ${theme.iconWarningColor};
    font-size: 14px;
  }
  .staking-button {
    margin-top: 10px;
    margin-bottom: 10px;
    width: 50%;
  }
  .validator-att-container {
    width: 100%;
    margin-bottom: 15px;
    display: flex;
    gap: 20px;
  }
  .validator-att {
    width: 50%;
  }
  .validator-detail-container {
    background: ${theme.accountAuthorizeRequest};
    padding: 10px 15px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    border-radius: 0 0 8px 8px;
  }
  .validator-expected-return {
    font-size: 14px;
    color: ${theme.textColor3};
  }
  .validator-item-toggle {
    border-style: solid;
    border-width: 0 2px 2px 0;
    display: inline-block;
    padding: 2.5px;
  }
  .validator-item-toggle-container {
    display: flex;
    align-items: center;
  }
  .validator-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
  }
  .validator-header {
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .identityIcon {
    border: 2px solid ${theme.checkDotColor};
  }
  .validator-item-container {
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: ${theme.backgroundAccountAddress};
    padding: 10px 15px;
    border-radius: 8px;
    gap: 10px;
  }
`));
