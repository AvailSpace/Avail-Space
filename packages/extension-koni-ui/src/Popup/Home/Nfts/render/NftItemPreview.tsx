// Copyright 2019-2022 @polkadot/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import CN from 'classnames';
import React, { useCallback, useState } from 'react';
import styled from 'styled-components';

import logo from '@polkadot/extension-koni-ui/assets/sub-wallet-logo.svg';
import Spinner from '@polkadot/extension-koni-ui/components/Spinner';
import useIsPopup from '@polkadot/extension-koni-ui/hooks/useIsPopup';
import { _NftItem } from '@polkadot/extension-koni-ui/Popup/Home/Nfts/types';
import { ThemeProps } from '@polkadot/extension-koni-ui/types';

interface Props {
  className?: string;
  data: _NftItem;
  onClick: (data: any) => void;
  collectionImage?: string;
}

function NftItemPreview ({ className, collectionImage, data, onClick }: Props): React.ReactElement<Props> {
  const [loading, setLoading] = useState(true);
  const [showImage, setShowImage] = useState(true);
  const [imageError, setImageError] = useState(false);
  const isPopup = useIsPopup();

  const handleOnLoad = useCallback(() => {
    setLoading(false);
  }, []);

  const handleOnClick = useCallback(() => {
    onClick(data);
  }, [data, onClick]);

  const handleImageError = useCallback(() => {
    setLoading(false);
    setShowImage(false);
  }, []);

  const handleVideoError = useCallback(() => {
    setImageError(true);
    setShowImage(true);
  }, []);

  const getItemImage = useCallback(() => {
    if (data.image && !imageError) {
      return data.image;
    } else if (collectionImage) {
      return collectionImage;
    }

    return logo;
  }, [collectionImage, data.image, imageError]);

  return (
    <div className={className}>
      <div
        className={CN('nft-preview', { full: !isPopup })}
        onClick={handleOnClick}
        style={{ height: isPopup ? 164 : 310 }}
      >
        <div className={'img-container'}>
          {
            loading &&
            <Spinner className={'img-spinner'} />
          }
          {
            showImage
              ? <img
                alt={'collection-thumbnail'}
                className={'collection-thumbnail'}
                onError={handleImageError}
                onLoad={handleOnLoad}
                src={getItemImage()}
                style={{ borderRadius: '5px 5px 0 0' }}
              />
              : <video
                autoPlay
                height='124'
                loop={true}
                muted
                onError={handleVideoError}
                width='124'
              >
                <source
                  src={getItemImage()}
                  type='video/mp4'
                />
              </video>
          }
        </div>

        <div className={'collection-title'}>
          <div
            className={'collection-name'}
            title={data.name ? data.name : `#${data?.id as string}`}
          >
            {data.name ? data.name : `#${data?.id as string}`}
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(styled(NftItemPreview)(({ theme }: ThemeProps) => `
  .img-container {
    position: relative;
  }

  .img-spinner {
    position: absolute;
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
      background-color: #181E42;
      box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.13);
      border-radius: 0 0 5px 5px;
    }

    .collection-item-count {
      font-size: 14px;
      margin-left: 5px;
      font-weight: normal;
      color: #7B8098;
    }
  }

  .nft-preview.full{
    width: 230px;

    .collection-thumbnail {
      height: 230px;
      width: 230px;
    }

    .img-container{
      height: 230px;
    }

    .collection-title {
      height: 80px;
      padding-left: 20px;
      padding-right: 20px;
      flex-direction: column;
      align-items: start;
      justify-content: center;
    }

    .collection-name{
      font-style: normal;
      font-weight: 500;
      font-size: 20px;
      line-height: 32px;
      color: #FFFFFF;
      width: 100%;
    }

    .collection-item-count{
      font-style: normal;
      font-weight: 400;
      font-size: 15px;
      line-height: 26px;
    }
  }
`));
