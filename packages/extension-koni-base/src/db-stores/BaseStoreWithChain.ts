// Copyright 2019-2022 @subwallet/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { DefaultDoc } from '../databases/dexie';
import BaseStore from './BaseStore';

export default class BaseStoreWithChain<T extends DefaultDoc> extends BaseStore<T> {
  public convertToJsonObject (items: T[]): Record<string, T> {
    return items.reduce((a, v) => ({ ...a, [v.chain]: v }), {});
  }
}
