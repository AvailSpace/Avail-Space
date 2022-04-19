// Copyright 2019-2022 @koniverse/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

// import { keyring } from '@polkadot/ui-keyring';

import { BackgroundWindow } from '@koniverse/extension-koni-base/background/types';
import { AccountIdIsh } from '@koniverse/extension-koni-ui/util/types';

const bWindow = chrome.extension.getBackgroundPage() as BackgroundWindow;
const { keyring } = bWindow.pdotApi;

export function getAccountCryptoType (accountId: AccountIdIsh): string {
  try {
    const current = accountId
      ? keyring.getPair(accountId.toString())
      : null;

    if (current) {
      return current.meta.isInjected
        ? 'injected'
        : current.meta.isHardware
          ? current.meta.hardwareType as string || 'hardware'
          : current.meta.isExternal
            ? current.meta.isMultisig
              ? 'multisig'
              : current.meta.isProxied
                ? 'proxied'
                : 'external'
            : current.type;
    }
  } catch {
    // cannot determine, keep unknown
  }

  return 'unknown';
}
