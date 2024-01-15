// Copyright 2019-2022 @subwallet/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { YieldPoolInfo, YieldPoolType } from '@subwallet/extension-base/types';
import { Layout } from '@subwallet/extension-koni-ui/components';
import { useSelector, useTranslation } from '@subwallet/extension-koni-ui/hooks';
import { useYieldPoolInfoByGroup } from '@subwallet/extension-koni-ui/hooks/earning';
import { EarningEntryParam, EarningEntryView, EarningPoolsParam, ThemeProps } from '@subwallet/extension-koni-ui/types';
import { SwList } from '@subwallet/react-ui';
import BigN from 'bignumber.js';
import CN from 'classnames';
import React, { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

type WrapperProps = ThemeProps;
type Props = WrapperProps & {
  poolGroup: string,
  symbol: string,
};

function Component ({ className, poolGroup, symbol }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const pools = useYieldPoolInfoByGroup(poolGroup);

  const chainInfoMap = useSelector((state) => state.chainStore.chainInfoMap);

  const items: YieldPoolInfo[] = useMemo(() => {
    if (!pools.length) {
      return [];
    }

    const result = [...pools];

    result.sort((a, b) => {
      const getType = (pool: YieldPoolInfo) => {
        if (pool.type === YieldPoolType.NOMINATION_POOL) {
          return 1;
        } else {
          return -1;
        }
      };

      const getTotal = (pool: YieldPoolInfo) => {
        const tvl = pool.statistic?.tvl;

        return tvl ? new BigN(tvl).toNumber() : -1;
      };

      return getTotal(b) - getTotal(a) || getType(b) - getType(a);
    });

    return result;
  }, [pools]);

  const onClickItem = useCallback((chainSlug: string, item: YieldPoolInfo) => {
    return () => {
      //
    };
  }, []);

  const renderItem = useCallback(
    (item: YieldPoolInfo) => {
      return (
        <div
          className={'earning-pool-item'}
          key={item.slug}
          onClick={onClickItem(chainInfoMap[item.chain].slug, item)}
        >
          <span>
            {item.slug}
          </span>
        </div>
      );
    },
    [chainInfoMap, onClickItem]
  );

  const searchFunction = useCallback(
    ({ chain, metadata: { shortName } }: YieldPoolInfo, searchText: string) => {
      const chainInfo = chainInfoMap[chain];

      return (
        chainInfo?.name.replace(' Relay Chain', '').toLowerCase().includes(searchText.toLowerCase()) ||
        shortName.toLowerCase().includes(searchText.toLowerCase())
      );
    },
    [chainInfoMap]
  );

  const onBack = useCallback(() => {
    navigate('/home/earning', { state: {
      view: EarningEntryView.OPTIONS
    } as EarningEntryParam });
  }, [navigate]);

  return (
    <Layout.Base
      className={CN(className)}
      onBack={onBack}
      showBackButton={true}
      showSubHeader={true}
      subHeaderBackground={'transparent'}
      subHeaderCenter={false}
      subHeaderPaddingVertical={true}
      title={t<string>('{{symbol}} earning options', { replace: { symbol: symbol } })}
    >
      <SwList.Section
        className={'__section-list-container'}
        enableSearchInput
        list={items}
        renderItem={renderItem}
        searchFunction={searchFunction}
        searchMinCharactersCount={2}
        searchPlaceholder={t<string>('Search token')}
        showActionBtn
      />
    </Layout.Base>
  );
}

const WrapperComponent = (props: WrapperProps) => {
  const locationState = useLocation().state as EarningPoolsParam;

  if (!locationState?.poolGroup || !locationState?.symbol) {
    // todo: will handle this with useEffect
    return (
      <div style={{
        display: 'flex',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      >
        Missing param
      </div>
    );
  }

  return (
    <Component
      {...props}
      poolGroup={locationState.poolGroup}
      symbol={locationState.symbol}
    />
  );
};

const EarningPools = styled(WrapperComponent)<Props>(({ theme: { token } }: ThemeProps) => ({
  '.__section-list-container': {
    height: '100%',
    flex: 1
  },

  '.earning-pool-item': {
    minHeight: 68,
    cursor: 'pointer',
    backgroundColor: token.colorBgSecondary,
    display: 'flex',
    alignItems: 'center',
    paddingRight: token.paddingSM,
    paddingLeft: token.paddingSM,
    gap: token.sizeXXS,

    '+ .earning-pool-item': {
      marginTop: token.marginXS
    }
  }
}));

export default EarningPools;
