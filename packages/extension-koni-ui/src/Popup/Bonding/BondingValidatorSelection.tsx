// Copyright 2019-2022 @subwallet/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ValidatorInfo } from '@subwallet/extension-base/background/KoniTypes';
import QuestionIcon from '@subwallet/extension-koni-ui/assets/Question.svg';
import { ActionContext, InputFilter } from '@subwallet/extension-koni-ui/components';
import Spinner from '@subwallet/extension-koni-ui/components/Spinner';
import Tooltip from '@subwallet/extension-koni-ui/components/Tooltip';
import useIsNetworkActive from '@subwallet/extension-koni-ui/hooks/screen/home/useIsNetworkActive';
import useTranslation from '@subwallet/extension-koni-ui/hooks/useTranslation';
import { getBondingOptions } from '@subwallet/extension-koni-ui/messaging';
import Header from '@subwallet/extension-koni-ui/partials/Header';
import ValidatorItem from '@subwallet/extension-koni-ui/Popup/Bonding/components/ValidatorItem';
import { CHAIN_TYPE_MAP } from '@subwallet/extension-koni-ui/Popup/Bonding/utils';
import { RootState } from '@subwallet/extension-koni-ui/stores';
import { ThemeProps } from '@subwallet/extension-koni-ui/types';
import React, { useCallback, useContext, useEffect, useState } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { useSelector } from 'react-redux';
import styled from 'styled-components';

interface Props extends ThemeProps {
  className?: string;
}

const INFINITE_SCROLL_PER_PAGE = window.innerHeight > 600 ? 15 : 10;

function BondingValidatorSelection ({ className }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { bondingParams, currentAccount: { account } } = useSelector((state: RootState) => state);
  const navigate = useContext(ActionContext);
  const [searchString, setSearchString] = useState('');
  const [loading, setLoading] = useState(true);
  const [maxNominatorPerValidator, setMaxNominatorPerValidator] = useState(0);
  const [allValidators, setAllValidators] = useState<ValidatorInfo[]>([]);
  const [isBondedBefore, setIsBondedBefore] = useState(false);
  const [bondedValidators, setBondedValidators] = useState<string[]>([]);
  const [maxNominations, setMaxNominations] = useState(1);
  const isNetworkActive = useIsNetworkActive(bondingParams.selectedNetwork !== null ? bondingParams.selectedNetwork : undefined);

  const [sortByCommission, setSortByCommission] = useState(false);
  const [sortByReturn, setSortByReturn] = useState(false);

  const [filteredValidators, setFilteredValidators] = useState<ValidatorInfo[]>([]);

  const [sliceIndex, setSliceIndex] = useState(INFINITE_SCROLL_PER_PAGE);
  const [showedValidators, setShowedValidators] = useState<ValidatorInfo[]>([]);

  const _height = window.innerHeight !== 600 ? (window.innerHeight * 0.68) : 330;

  useEffect(() => {
    if (!isNetworkActive) {
      navigate('/account/select-bonding-network');
    }
  }, [isNetworkActive, navigate]);

  const handleSortByCommission = useCallback(() => {
    if (!sortByCommission) {
      setSortByReturn(false);
    }

    setSortByCommission(!sortByCommission);
  }, [sortByCommission]);

  const handleSortByReturn = useCallback(() => {
    if (!sortByReturn) {
      setSortByCommission(false);
    }

    setSortByReturn(!sortByReturn);
  }, [sortByReturn]);

  const filterValidators = useCallback(() => {
    const _filteredValidators: ValidatorInfo[] = [];

    allValidators.forEach((validator) => {
      if (validator.address.toLowerCase().includes(searchString.toLowerCase()) || (validator.identity && validator.identity.toLowerCase().includes(searchString.toLowerCase()))) {
        _filteredValidators.push(validator);
      }
    });

    if (sortByReturn) {
      return _filteredValidators
        .sort((validator: ValidatorInfo, _validator: ValidatorInfo) => {
          if (validator.expectedReturn > _validator.expectedReturn) {
            return -1;
          } else if (validator.expectedReturn <= _validator.expectedReturn) {
            return 1;
          }

          return 0;
        });
    } else if (sortByCommission) {
      return _filteredValidators
        .sort((validator: ValidatorInfo, _validator: ValidatorInfo) => {
          if (validator.commission <= _validator.commission) {
            return -1;
          } else if (validator.commission > _validator.commission) {
            return 1;
          }

          return 0;
        });
    }

    return _filteredValidators;
  }, [allValidators, searchString, sortByCommission, sortByReturn]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const _filteredValidators = filterValidators();

      setFilteredValidators(_filteredValidators);
      setShowedValidators(_filteredValidators.slice(0, INFINITE_SCROLL_PER_PAGE));
      setSliceIndex(INFINITE_SCROLL_PER_PAGE);
    }, 100);

    return () => clearTimeout(delayDebounceFn);
  }, [searchString, sortByReturn, sortByCommission, filterValidators]);

  const _onChangeFilter = useCallback((val: string) => {
    setSearchString(val);
  }, []);

  useEffect(() => {
    if (bondingParams.selectedNetwork === null) {
      navigate('/account/select-bonding-network');
    } else {
      getBondingOptions(bondingParams.selectedNetwork, account?.address as string)
        .then((bondingOptionInfo) => {
          setMaxNominatorPerValidator(bondingOptionInfo.maxNominatorPerValidator);
          setIsBondedBefore(bondingOptionInfo.isBondedBefore);
          setBondedValidators(bondingOptionInfo.bondedValidators);
          setMaxNominations(bondingOptionInfo.maxNominations);

          const sortedValidators = bondingOptionInfo.validators
            .sort((validator: ValidatorInfo, _validator: ValidatorInfo) => {
              if (validator.isVerified && !_validator.isVerified) {
                return -1;
              } else if (!validator.isVerified && _validator.isVerified) {
                return 1;
              }

              return 0;
            });

          setAllValidators(sortedValidators);
          setFilteredValidators(sortedValidators);
          setShowedValidators(sortedValidators.slice(0, sliceIndex + 1));
          setLoading(false);
        })
        .catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClickHelper = useCallback(() => {
    // eslint-disable-next-line no-void
    void chrome.tabs.create({ url: 'https://support.polkadot.network/support/solutions/articles/65000150130-how-do-i-know-which-validators-to-choose-', active: true }).then(() => console.log('redirecting'));
  }, []);

  const handleLoadOnScroll = useCallback(() => {
    const _sliceIndex = sliceIndex;

    setShowedValidators(filteredValidators.slice(0, _sliceIndex + INFINITE_SCROLL_PER_PAGE + 1));
    setSliceIndex(_sliceIndex + INFINITE_SCROLL_PER_PAGE);
  }, [filteredValidators, sliceIndex]);

  const getSubHeaderTitle = useCallback(() => {
    if (CHAIN_TYPE_MAP.astar.includes(bondingParams.selectedNetwork as string)) {
      return 'Select a dApp';
    } else if (CHAIN_TYPE_MAP.para.includes(bondingParams.selectedNetwork as string)) {
      return 'Select a collator';
    }

    return 'Select a validator';
  }, [bondingParams.selectedNetwork]);

  return (
    <div className={className}>
      <Header
        cancelButtonText={'Close'}
        isShowNetworkSelect={false}
        showBackArrow
        showCancelButton={true}
        showSubHeader
        subHeaderName={t<string>(getSubHeaderTitle())}
        to='/account/select-bonding-network'
      >
        <div className={'bonding-input-filter-container'}>
          <InputFilter
            onChange={_onChangeFilter}
            placeholder={t<string>('Search validator...')}
            value={searchString}
            withReset
          />
        </div>
      </Header>

      <div className='bonding__button-area'>
        <div
          className={'staking-help'}
          onClick={handleClickHelper}
        >
          <img
            data-for={'staking-helper'}
            data-tip={true}
            height={24}
            src={QuestionIcon}
            width={24}
          />
          <Tooltip
            place={'top'}
            // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
            text={'How do I know which validators to choose ?'}
            trigger={'staking-helper'}
          />
        </div>

        <div className={'filter-container'}>
          <div
            className={`${sortByCommission ? 'active-bonding__btn' : 'bonding__btn'}`}
            onClick={handleSortByCommission}
          >
            {t<string>('Lowest commission')}
          </div>
          <div
            className={`${sortByReturn ? 'active-bonding__btn' : 'bonding__btn'} sort-return-btn`}
            onClick={handleSortByReturn}
          >
            {t<string>('Highest return')}
          </div>
        </div>
      </div>

      <div
        className={'validator-list'}
        id='scrollableDiv'
        style={{ height: `${_height}px` }}
      >
        {
          loading && <Spinner />
        }
        {
          !loading && <InfiniteScroll
            className={'scroll-container'}
            dataLength={showedValidators.length}
            hasMore={showedValidators.length < filteredValidators.length}
            loader={<div />}
            next={handleLoadOnScroll}
            scrollableTarget='scrollableDiv'
          >
            {
              showedValidators.map((validator, index) => {
                return <ValidatorItem
                  bondedValidators={bondedValidators}
                  isBondedBefore={isBondedBefore}
                  key={`${index}-${validator.address}`}
                  maxNominations={maxNominations}
                  maxNominatorPerValidator={maxNominatorPerValidator}
                  networkKey={bondingParams.selectedNetwork}
                  validatorInfo={validator}
                />;
              })
            }
          </InfiniteScroll>
        }
      </div>
    </div>
  );
}

export default React.memo(styled(BondingValidatorSelection)(({ theme }: Props) => `
  .staking-help {
    cursor: pointer;
    display: flex;
    align-items: center;
  }

  .filter-container {
    width: 70%;
    display: flex;
    justify-content: flex-end;
    align-items: center;
  }

  .sort-return-btn:before {
    content: '';
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: ${theme.textColor2};
    top: 0;
    bottom: 0;
    left: 7px;
    margin: auto 0;
  }

  .sort-return-btn {
    padding-left: 20px;
  }

  .validator-selection-helper {
    margin-left: 15px;
    margin-top: 15px;
    cursor: pointer;
    font-size: 14px;
    color: ${theme.textColor3};
  }

  .validator-selection-helper:hover {
    text-decoration: underline;
  }

  .bonding__btn {
    cursor: pointer;
    position: relative;
    font-size: 14px;
    color: ${theme.textColor2};
  }

  .active-bonding__btn {
    cursor: pointer;
    position: relative;
    font-size: 14px;
    color: ${theme.textColor3};
  }

  .bonding__btn:hover {
    color: ${theme.textColor3};
  }

  .bonding__button-area {
    display: flex;
    justify-content: space-between;
    padding: 10px 15px;
    align-items: center;
  }

  .bonding-input-filter-container {
    padding: 0 15px 12px;
  }

  .validator-list {
    margin-top: 10px;
    padding-top: 5px;
    padding-bottom: 5px;
    padding-left: 15px;
    padding-right: 15px;
    overflow-y: scroll;
    scrollbar-width: thin;
  }

  .scroll-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
`));
