// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { DefaultLogosMap } from '@subwallet/extension-koni-ui/assets/logo';
import { SUBSTRATE_GENERIC_KEY } from '@subwallet/extension-koni-ui/constants';

const SwLogosMap: Record<string, string> = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  subwallet: require('./subwallet.png'),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  avatar_placeholder: require('./avatar_placeholder.png'),
  default: DefaultLogosMap.default,
  transak: DefaultLogosMap.transak,
  onramper: DefaultLogosMap.onramper,
  moonpay: DefaultLogosMap.moonpay,
  banxa: DefaultLogosMap.banxa,
  coinbase: DefaultLogosMap.coinbase,
  [SUBSTRATE_GENERIC_KEY]: DefaultLogosMap[SUBSTRATE_GENERIC_KEY]
};

export default SwLogosMap;
