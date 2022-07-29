// Copyright 2019-2022 @subwallet/extension-koni authors & contributors
// SPDX-License-Identifier: Apache-2.0

import State from '@subwallet/extension-koni-base/background/handlers/State';
import ApplicationStore from '@subwallet/extension-koni-base/stores/Application';

import BaseMigrationJob from './Base';
import MigrationScripts from './scripts';

export default class Migration {
  private readonly appStore = new ApplicationStore();
  readonly state: State;

  constructor (state: State) {
    this.state = state;
  }

  public async run (): Promise<void> {
    const appVersion = process.env.PKG_VERSION || '0.0.0';
    const storedVersion = await this.appStore.getVersion() || '0.0.0';

    console.log('Running version: ', appVersion);

    if (appVersion <= storedVersion) {
      return Promise.resolve(console.log('No need to migrate.'));
    }

    console.log('Migrating...');
    const scripts = this.getRunableScripts(storedVersion, appVersion);

    try {
      for (let i = 0; i < scripts.length; i++) {
        const JobClass = scripts[i];

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const job = new JobClass(this.state);

        console.log('[Migration] running script: ', JobClass.name);
        await job.run();
      }

      await this.appStore.setVersion(appVersion);
    } catch (error) {
      console.warn('Migration error: ', error);
    }

    console.log('Migration done.');
  }

  private getRunableScripts (fromVersion: string, toVersion: string) {
    const scripts: typeof BaseMigrationJob[] = [];
    const missingVersions = Object.keys(MigrationScripts).filter((version) => version > fromVersion && version <= toVersion).sort();

    missingVersions.forEach((ver) => {
      scripts.push(...MigrationScripts[ver]);
    });

    return scripts;
  }
}
