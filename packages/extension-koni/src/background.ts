// Copyright 2019-2022 @polkadot/extension authors & contributors
// SPDX-License-Identifier: Apache-2.0

// Runs in the extension background, handling all keyring access

import '@subwallet/extension-inject/crossenv';

import type { RequestSignatures, TransportRequestMessage } from '@subwallet/extension-base/background/types';

import { withErrorLog } from '@subwallet/extension-base/background/handlers/helpers';
import { PORT_CONTENT, PORT_EXTENSION, PORT_KEEP_ALIVE } from '@subwallet/extension-base/defaults';
import { AccountsStore } from '@subwallet/extension-base/stores';
import { KoniCron } from '@subwallet/extension-koni-base/background/cron';
import { onExtensionInstall } from '@subwallet/extension-koni-base/background/events';
import handlers from '@subwallet/extension-koni-base/background/handlers';
import { KoniSubscription } from '@subwallet/extension-koni-base/background/subscription';

import keyring from '@polkadot/ui-keyring';
import { assert } from '@polkadot/util';
import { cryptoWaitReady } from '@polkadot/util-crypto';

// setup the notification (same a FF default background, white text)
withErrorLog(() => chrome.action.setBadgeBackgroundColor({ color: '#d90000' }));

// listen to all messages and handle appropriately
chrome.runtime.onConnect.addListener((port): void => {
  // shouldn't happen, however... only listen to what we know about
  assert([PORT_CONTENT, PORT_EXTENSION, PORT_KEEP_ALIVE].includes(port.name), `Unknown connection from ${port.name}`);

  if (port.name === PORT_KEEP_ALIVE) {
    console.log('Keep-alive port connected.');
    port.onDisconnect.addListener(deleteTimer);
    (port as KeepAlivePort)._timer = setTimeout(forceReconnect, 4.9 * 60 * 1000, port);
  } else {
    // message and disconnect handlers
    port.onMessage.addListener((data: TransportRequestMessage<keyof RequestSignatures>) => handlers(data, port));
    port.onDisconnect.addListener(() => console.log(`Disconnected from ${port.name}`));
  }
});

// Trigger single mode
chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') {
    onExtensionInstall();
  }
});

// Persistent service worker
interface KeepAlivePort extends chrome.runtime.Port {
  _timer: number | undefined
}

function forceReconnect (port: KeepAlivePort) {
  deleteTimer(port);
  port.disconnect();
}

function isKeepAlivePort (obj: any): obj is KeepAlivePort {
  return '_timer' in obj;
}

function deleteTimer (port: chrome.runtime.Port | KeepAlivePort) {
  if (isKeepAlivePort(port) && port._timer) {
    clearTimeout(port._timer);
    delete port._timer;
  }
}

// initial setup
cryptoWaitReady()
  .then((): void => {
    console.log('crypto initialized');

    // load all the keyring data
    keyring.loadAll({ store: new AccountsStore(), type: 'sr25519' });

    // Init subscription
    const subscriptions = new KoniSubscription();

    subscriptions.init();

    // Init cron
    (new KoniCron(subscriptions)).init();

    console.log('initialization completed');
  })
  .catch((error): void => {
    console.error('initialization failed', error);
  });
