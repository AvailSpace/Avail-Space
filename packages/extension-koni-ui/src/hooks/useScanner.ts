// Copyright 2019-2022 @polkadot/extension-koni-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { AccountContext } from '@subwallet/extension-koni-ui/components';
import { SCANNER_QR_STEP } from '@subwallet/extension-koni-ui/constants/qr';
import strings from '@subwallet/extension-koni-ui/constants/strings';
import { ScannerContext } from '@subwallet/extension-koni-ui/contexts/ScannerContext';
import { RootState } from '@subwallet/extension-koni-ui/stores';
import { CompletedParsedData, EthereumParsedData, NetworkParsedData, ParsedData, SubstrateCompletedParsedData, SubstrateParsedData } from '@subwallet/extension-koni-ui/types/scanner';
import { constructDataFromBytes, isAddressString, isJsonString, rawDataToU8A } from '@subwallet/extension-koni-ui/util/decoders';
import { isMultiFramesInfo, isMultipartData, isNetworkParsedData } from '@subwallet/extension-koni-ui/util/scanner/sign';
import { Result as TxRequestData } from '@zxing/library';
import { useCallback, useContext } from 'react';
import { useSelector } from 'react-redux';

import { hexStripPrefix, u8aToHex } from '@polkadot/util';

interface ProcessBarcodeFunction {
  (txRequestData: TxRequestData): void
}

const useScanner = (showAlertMessage: (message: string) => void): ProcessBarcodeFunction => {
  const { getAccountByAddress } = useContext(AccountContext);
  const scannerStore = useContext(ScannerContext);

  const { networkMap } = useSelector((state: RootState) => state);

  const { cleanup, clearMultipartProgress, setData, setStep } = scannerStore;

  const parseQrData = useCallback((txRequestData: TxRequestData): ParsedData => {
    if (isAddressString(txRequestData.getText())) {
      throw new Error(strings.ERROR_ADDRESS_MESSAGE);
    } else if (isJsonString(txRequestData.getText())) {
      // Add Network
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsedJsonData = JSON.parse(txRequestData.getText());

      // eslint-disable-next-line no-prototype-builtins,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
      if (parsedJsonData.hasOwnProperty('genesisHash')) {
        return {
          action: 'addNetwork',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          data: parsedJsonData
        } as NetworkParsedData;
      }

      // Ethereum Legacy
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return parsedJsonData;
    } else if (!scannerStore.state.multipartComplete) {
      const bytes = txRequestData.getRawBytes();
      const _raw = hexStripPrefix(u8aToHex(bytes));
      const strippedData = rawDataToU8A(_raw);

      if (strippedData === null) {
        throw new Error(strings.ERROR_NO_RAW_DATA);
      }

      return constructDataFromBytes(strippedData, false, networkMap);
    } else {
      throw new Error(strings.ERROR_NO_RAW_DATA);
    }
  }, [scannerStore.state.multipartComplete, networkMap]);

  const checkMultiFramesData = useCallback((parsedData: SubstrateParsedData | EthereumParsedData): null | CompletedParsedData => {
    if (isMultipartData(parsedData)) {
      const multiFramesResult = scannerStore.setPartData(parsedData.currentFrame, parsedData.frameCount, parsedData.partData);

      if (isMultiFramesInfo(multiFramesResult)) {
        return null;
      }

      // Otherwise all the frames are assembled as completed parsed data
      return multiFramesResult;
    } else {
      return parsedData;
    }
  }, [scannerStore]);

  const processBarCode = useCallback((txRequestData: TxRequestData): void => {
    try {
      const parsedData = parseQrData(txRequestData);

      const genesisHash = (parsedData as SubstrateCompletedParsedData)?.data?.genesisHash;

      if (isNetworkParsedData(parsedData)) {
        return showAlertMessage('Adding a network is not supported in this screen');
      }

      const unsignedData = checkMultiFramesData(parsedData);

      if (unsignedData === null) {
        return showAlertMessage('Unsigned data is null');
      }

      const qrInfo = setData(unsignedData);

      clearMultipartProgress();

      const { senderAddress } = qrInfo;
      const senderAccount = getAccountByAddress(networkMap, senderAddress, genesisHash);

      if (!senderAccount) {
        cleanup();

        return showAlertMessage(strings.ERROR_NO_SENDER_FOUND);
      }

      if (senderAccount.isExternal) {
        cleanup();

        return showAlertMessage(strings.ERROR_NO_EXTERNAL_ACCOUNT);
      }

      setStep(SCANNER_QR_STEP.CONFIRM_STEP);

      return showAlertMessage('');
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : 'unknown error :(';

      return showAlertMessage(message);
    }
  }, [parseQrData, checkMultiFramesData, setData, clearMultipartProgress, getAccountByAddress, networkMap, setStep, showAlertMessage, cleanup]);

  return processBarCode;
};

export default useScanner;
