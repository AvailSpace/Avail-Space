// Copyright 2019-2022 @polkadot/extension authors & contributors
// SPDX-License-Identifier: Apache-2.0

import type { Message } from '@subwallet/extension-base/types';

import { TransportRequestMessage } from '@subwallet/extension-base/background/types';
import { MESSAGE_ORIGIN_CONTENT, MESSAGE_ORIGIN_PAGE, PORT_CONTENT } from '@subwallet/extension-base/defaults';
import { isManifestV3 } from '@subwallet/extension-base/utils';
import { getId } from '@subwallet/extension-base/utils/getId';
import { chrome } from '@subwallet/extension-inject/chrome';

// connect to the extension
let port: chrome.runtime.Port | null;

function connect () {
  if (!port) {
    port = chrome.runtime.connect({ name: PORT_CONTENT });
    port.onDisconnect.addListener(() => {
      port = null;
      console.log(`Port [${PORT_CONTENT}] is disconnected.`);
    });

    // const port = chrome.runtime.connect({ name: PORT_CONTENT });

    // send any messages from the extension back to the page
    port.onMessage.addListener((data: {id: string, response: any}): void => {
      const { id, resolve } = handleRedirectPhishing;

      if (data?.id === id) {
        resolve && resolve(Boolean(data.response));
      } else {
        window.postMessage({ ...data, origin: MESSAGE_ORIGIN_CONTENT }, '*');
      }
    });
  }
}

connect();

async function makeSurePortConnected () {
  const poll = (resolve: (value: unknown) => void) => {
    if (port) {
      resolve(true);
    } else {
      console.log(`Port [${PORT_CONTENT}] is connecting...`);
      setTimeout(() => poll(resolve), 400);
    }
  };

  return new Promise(poll);
}

// redirect users if this page is considered as phishing, otherwise return false
const handleRedirectPhishing: { id: string, resolve?: (value: (boolean | PromiseLike<boolean>)) => void, reject?: (e: Error) => void } = {
  id: 'redirect-phishing-' + getId()
};

const redirectIfPhishingProm = new Promise<boolean>((resolve, reject) => {
  handleRedirectPhishing.resolve = resolve;
  handleRedirectPhishing.reject = reject;

  const transportRequestMessage: TransportRequestMessage<'pub(phishing.redirectIfDenied)'> = {
    id: handleRedirectPhishing.id,
    message: 'pub(phishing.redirectIfDenied)',
    origin: MESSAGE_ORIGIN_PAGE,
    request: null
  };

  makeSurePortConnected().then(() => {
    port && port.postMessage(transportRequestMessage);
  }).catch((e) => console.warn(e));
});

// all messages from the page, pass them to the extension
window.addEventListener('message', ({ data, source }: Message): void => {
  // only allow messages from our window, by the inject
  if (source !== window || data.origin !== MESSAGE_ORIGIN_PAGE) {
    return;
  }

  if (!port) {
    connect();
  }

  makeSurePortConnected().then(() => {
    port && port.postMessage(data);
  }).catch((e) => console.warn(e));
});

// inject our data injector
const container = document.head || document.documentElement;
const placeholderScript = document.createElement('script');
const script = document.createElement('script');

placeholderScript.textContent = `class SubWalletPlaceholder {
  provider = undefined;
  isSubWallet = true;
  connected = false;
  isConnected = () => false;
  __waitProvider = async () => {
    const self = this;
    if (self.provider) {
      return self.provider;
    } else {
      return await new Promise((resolve, reject) => {
        let retry = 0;
        const interval = setInterval(() => {
          if (++retry > 30) {
            clearInterval(interval);
            reject(new Error('SubWallet provider not found'))
          }
          if (self.provider) {
            clearInterval(interval);
            resolve(self.provider)
          }
        }, 100);
      })
    }
  }
  on() {
    this.__waitProvider().then((provider) => {
      provider.on(...arguments);
    });
  }
  off() {
    this.__waitProvider().then((provider) => {
      provider.off(...arguments);
    });
  }
  addListener() {
    this.__waitProvider().then((provider) => {
      provider.addListener(...arguments);
    });
  }
  removeListener() {
    this.__waitProvider().then((provider) => {
      provider.removeListener(...arguments);
    });
  }
  removeAllListeners() {
    this.__waitProvider().then((provider) => {
      provider.removeAllListeners(...arguments);
    });
  }
  async enable() {
    const provider = await this.__waitProvider();
    return await provider.enable(...arguments);
  }
  async request() {
    const provider = await this.__waitProvider();
    return await provider.request(...arguments);
  }
  async send() {
    const provider = await this.__waitProvider();
    return await provider.send(...arguments);
  }
  async sendAsync() {
    const provider = await this.__waitProvider();
    return await provider.sendAsync(...arguments);
  }
}


window.SubWallet = new Proxy(new SubWalletPlaceholder(), {
  get(obj, prop) {
    if (prop === 'provider') {
      return undefined;
    }

    if (obj.provider) {
      return Reflect.get(obj.provider, prop);
    } else {
      return Reflect.get(obj, prop);
    }
  }
})`;
script.src = isManifestV3() ? chrome.runtime.getURL('page.js') : chrome.extension.getURL('page.js');

script.onload = (): void => {
  // remove the injecting tag when loaded
  script.parentNode && script.parentNode.removeChild(script);
  placeholderScript.parentNode && placeholderScript.parentNode.removeChild(placeholderScript);
};

container.insertBefore(placeholderScript, container.children[0]);
container.insertBefore(script, container.children[0]);

redirectIfPhishingProm.then((gotRedirected) => {
  if (!gotRedirected) {
    console.log('Check phishing by URL: Passed.');
  }
}).catch((e) => {
  console.warn(`Unable to determine if the site is in the phishing list: ${(e as Error).message}`);
});
