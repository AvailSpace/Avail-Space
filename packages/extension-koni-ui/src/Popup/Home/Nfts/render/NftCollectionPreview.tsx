// Copyright 2019-2022 @polkadot/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { useCallback, useState } from 'react';
// @ts-ignore
import LazyLoad from 'react-lazyload';
import styled from 'styled-components';

import logo from '@polkadot/extension-koni-ui/assets/sub-wallet-logo.svg';
import Spinner from '@polkadot/extension-koni-ui/components/Spinner';
import { _NftCollection } from '@polkadot/extension-koni-ui/Popup/Home/Nfts/types';
import { ThemeProps } from '@polkadot/extension-koni-ui/types';

interface Props {
  className?: string;
  data: _NftCollection;
  onClick: (data: _NftCollection) => void;
}

function NftCollectionPreview ({ className, data, onClick }: Props): React.ReactElement<Props> {
  const [loading, setLoading] = useState(true);

  const handleOnLoad = useCallback(() => {
    setLoading(false);
  }, []);

  const handleOnClick = useCallback(() => {
    onClick(data);
  }, [data, onClick]);

  return (
    <div className={className}>
      <div
        className={'nft-preview'}
        onClick={handleOnClick}
        style={{ height: '164px' }}
      >
        <div className={'img-container'}>
          {
            loading &&
            <Spinner className={'img-spinner'} />
          }
          <LazyLoad>
            <img
              alt={'collection-thumbnail'}
              className={'collection-thumbnail'}
              onLoad={handleOnLoad}
              src={data.image ? data?.image : logo}
              style={{ borderRadius: '5px 5px 0 0', opacity: loading ? '0.3' : '1' }}
            />
          </LazyLoad>
        </div>

        <div className={'collection-title'}>
          <div
            className={'collection-name'}
            title={data.collectionName ? data.collectionName : data?.collectionId}
          >
            {/* show only first 10 characters */}
            {data.collectionName ? data.collectionName : data?.collectionId}
          </div>
          {/* @ts-ignore */}
          <div className={'collection-item-count'}>{data?.nftItems.length}</div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(styled(NftCollectionPreview)(({ theme }: ThemeProps) => `
  .img-container {
    position: relative;
    height: 124px;
    width: 124px;
  }

  .img-spinner {
    top: 50%;
  }

  .nft-preview {
    box-shadow: 0px 0px 3px rgba(0, 0, 0, 0.2);
    width: 124px;
    &:hover {
      cursor: pointer;
    }

    .collection-thumbnail {
      display: block;
      height: 124px;
      width: 124px;
      object-fit: contain;
    }

    .collection-name {
      width: 70%
      text-transform: capitalize;
      font-size: 16px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .collection-title {
      height: 40px;
      padding-left: 10px;
      padding-right: 10px;
      display: flex;
      align-items: center;
      background-color: ${theme.popupBackground};
      box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.13);
      border-radius: 0 0 5px 5px;
    }

    .collection-item-count {
      font-size: 14px;
      margin-left: 5px;
      font-weight: normal;
      color: ${theme.iconNeutralColor};
    }
  }
`));
