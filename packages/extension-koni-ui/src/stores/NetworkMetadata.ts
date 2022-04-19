// Copyright 2019-2022 @koniverse/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { NetWorkMetadataDef } from '@koniverse/extension-koni-base/background/types';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import chains from '../util/chains';

function getNetworkMetadataMap (networkMetaDataItems: NetWorkMetadataDef[]): Record<string, NetWorkMetadataDef> {
  const result: Record<string, NetWorkMetadataDef> = {};

  networkMetaDataItems.forEach((item) => {
    result[item.networkKey] = item;
  });

  return result;
}

const initialState = getNetworkMetadataMap(chains);

const networkMetadataSlice = createSlice({
  initialState,
  name: 'networkMetadata',
  reducers: {
    update (state, action: PayloadAction<NetWorkMetadataDef[]>) {
      const { payload } = action;

      payload.forEach((item) => {
        state[item.networkKey] = item;
      });
    }
  }
});

export const { update: updateNetworkMetadata } = networkMetadataSlice.actions;
export default networkMetadataSlice.reducer;
