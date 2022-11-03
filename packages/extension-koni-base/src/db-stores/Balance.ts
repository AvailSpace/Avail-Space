// Copyright 2019-2022 @subwallet/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { BalanceJson } from '@subwallet/extension-base/background/KoniTypes';
import { liveQuery, Subscription } from 'dexie';

import { IBalance } from '../databases/dexie';
import BaseStoreWithAddress from '../db-stores/BaseStoreWithAddress';

export default class BalanceStore extends BaseStoreWithAddress<IBalance> {
  private balanceSub!: Subscription;
  liveQueryBalance (address: string, cb: (result: BalanceJson) => void) {
    if (this.balanceSub) {
      this.balanceSub.unsubscribe();
    }

    const subscription = liveQuery(
      () => this.table.where('address').equals(address).toArray()
    );

    this.balanceSub = subscription.subscribe({
      next: (rs) => {
        const data = this.convertToJsonObject(rs);

        if (Object.keys(data).length) {
          const res: BalanceJson = { details: data };

          cb(res);
        }
      }
    });

    return this.balanceSub;
  }
}
