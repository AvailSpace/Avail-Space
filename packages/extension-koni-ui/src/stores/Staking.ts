// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { StakingJson } from '@subwallet/extension-base/background/KoniTypes';

const initialState = {
  ready: false,
  details: {}
} as StakingJson;

const stakingSlice = createSlice({
  initialState,
  name: 'staking',
  reducers: {
    update (state, action: PayloadAction<StakingJson>) {
      const payload = action.payload;

      if (payload.ready !== undefined) {
        state.ready = payload.ready;
      }

      if (payload.reset) {
        state.details = payload.details;
      } else {
        state.details = { ...state.details, ...payload.details };
      }
    }
  }
});

export const { update } = stakingSlice.actions;
export default stakingSlice.reducer;
