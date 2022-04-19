// Copyright 2019-2022 @koniverse/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

const createConfig = require('./webpack.shared.cjs');

module.exports = createConfig({
  background: './src/background.ts',
  content: './src/content.ts',
  extension: './src/extension.ts',
  page: './src/page.ts'
});
