// Copyright 2019-2022 @subwallet/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

import BaseMigrationJob from '../Base';
// import ChangeTransactionHistoryStore from './ChangeTransactionHistoryStore';
// import RemoveWrongTransactionHistoriesFromStore from './RemoveWrongTransactionHistoriesFromStore';
import FixMissingTransactionHistory from './FixMissingTransactionHistory';

export default <Record<string, typeof BaseMigrationJob[]>> {
  '0.4.4-0': [
    // ChangeTransactionHistoryStore
  ],
  '0.4.6-2': [
    // RemoveWrongTransactionHistoriesFromStore
  ],
  '0.5.3-2': [
    FixMissingTransactionHistory
  ]
};
