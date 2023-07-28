// Copyright 2019-2022 @polkadot/extension-ui authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Layout, Logo2DWithBorder } from '@subwallet/extension-koni-ui/components';
import { DEFAULT_ACCOUNT_TYPES, DOWNLOAD_EXTENSION } from '@subwallet/extension-koni-ui/constants';
import { ATTACH_ACCOUNT_MODAL, CREATE_ACCOUNT_MODAL, IMPORT_ACCOUNT_MODAL, SELECT_ACCOUNT_MODAL } from '@subwallet/extension-koni-ui/constants/modal';
import useTranslation from '@subwallet/extension-koni-ui/hooks/common/useTranslation';
import { createAccountExternalV2 } from '@subwallet/extension-koni-ui/messaging';
import { RootState } from '@subwallet/extension-koni-ui/stores';
import { PhosphorIcon, ThemeProps } from '@subwallet/extension-koni-ui/types';
import { Button, ButtonProps, Form, Icon, Input, ModalContext } from '@subwallet/react-ui';
import CN from 'classnames';
import { FileArrowDown, PlusCircle, PuzzlePiece, Swatches, Wallet } from 'phosphor-react';
import { Callbacks, FieldData, RuleObject } from 'rc-field-form/lib/interface';
import React, { useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import SocialGroup from '../components/SocialGroup';
import { EXTENSION_URL } from '../constants';
import { ScreenContext } from '../contexts/ScreenContext';
import useGetDefaultAccountName from '../hooks/account/useGetDefaultAccountName';
import useDefaultNavigate from '../hooks/router/useDefaultNavigate';
import { convertFieldToObject, isNoAccount, openInNewTab, readOnlyScan, setSelectedAccountTypes, simpleCheckForm } from '../utils';

type Props = ThemeProps;

interface ReadOnlyAccountInput {
  address?: string;
}

interface WelcomeButtonItem {
  id: string;
  icon: PhosphorIcon;
  schema: ButtonProps['schema'];
  title: string;
  description: string;
}

function Component ({ className }: Props): React.ReactElement<Props> {
  const { t } = useTranslation();
  const { activeModal, inactiveModal } = useContext(ModalContext);
  const { isWebUI } = useContext(ScreenContext);
  const navigate = useNavigate();

  const [form] = Form.useForm<ReadOnlyAccountInput>();
  const autoGenAttachReadonlyAccountName = useGetDefaultAccountName();
  const [reformatAttachAddress, setReformatAttachAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAttachAddressEthereum, setAttachAddressEthereum] = useState(false);
  const [isAttachReadonlyAccountButtonDisable, setIsAttachReadonlyAccountButtonDisable] = useState(true);
  const accounts = useSelector((root: RootState) => root.accountState.accounts);
  const [isAccountsEmpty] = useState(isNoAccount(accounts));
  const { goHome } = useDefaultNavigate();

  const formDefault: ReadOnlyAccountInput = {
    address: ''
  };

  const handleResult = useCallback((val: string) => {
    const result = readOnlyScan(val);

    if (result) {
      setReformatAttachAddress(result.content);
      setAttachAddressEthereum(result.isEthereum);
    }
  }, []);

  const onFieldsChange: Callbacks<ReadOnlyAccountInput>['onFieldsChange'] =
    useCallback(
      (changes: FieldData[], allFields: FieldData[]) => {
        const { empty, error } = simpleCheckForm(allFields);

        setIsAttachReadonlyAccountButtonDisable(error || empty);

        const changeMap = convertFieldToObject<ReadOnlyAccountInput>(changes);

        if (changeMap.address) {
          handleResult(changeMap.address);
        }
      },
      [handleResult]
    );

  const accountAddressValidator = useCallback(
    (rule: RuleObject, value: string) => {
      const result = readOnlyScan(value);

      if (result) {
        // For each account, check if the address already exists return promise reject
        for (const account of accounts) {
          if (account.address === result.content) {
            setReformatAttachAddress('');

            return Promise.reject(t('Account already exists'));
          }
        }
      } else {
        setReformatAttachAddress('');

        if (value !== '') {
          return Promise.reject(t('Invalid address'));
        }
      }

      return Promise.resolve();
    },
    [accounts, t]
  );

  const onSubmitAttachReadonlyAccount = useCallback(() => {
    setLoading(true);

    if (reformatAttachAddress) {
      createAccountExternalV2({
        name: autoGenAttachReadonlyAccountName,
        address: reformatAttachAddress,
        genesisHash: '',
        isEthereum: isAttachAddressEthereum,
        isAllowed: true,
        isReadOnly: true
      })
        .then((errors) => {
          if (errors.length) {
            form.setFields([
              { name: 'address', errors: errors.map((e) => e.message) }
            ]);
          } else {
            navigate('/create-done');
          }
        })
        .catch((error: Error) => {
          form.setFields([{ name: 'address', errors: [error.message] }]);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [reformatAttachAddress, autoGenAttachReadonlyAccountName, isAttachAddressEthereum, form, navigate]);

  const items = useMemo((): WelcomeButtonItem[] => [
    {
      description: t('Create a new account with SubWallet'),
      icon: PlusCircle,
      id: CREATE_ACCOUNT_MODAL,
      schema: 'secondary',
      title: t('Create a new account')
    },
    {
      description: t('Import an existing account'),
      icon: FileArrowDown,
      id: IMPORT_ACCOUNT_MODAL,
      schema: 'secondary',
      title: t('Import an account')
    },
    {
      description: t('Attach an account without private key'),
      icon: Swatches,
      id: ATTACH_ACCOUNT_MODAL,
      schema: 'secondary',
      title: t('Attach an account')
    },
    {
      description: 'For management of your account keys',
      icon: PuzzlePiece,
      id: DOWNLOAD_EXTENSION,
      schema: 'secondary',
      title: t('Download SubWallet extension')
    }
  ], [t]);

  const buttonList = useMemo(() => isWebUI ? items : items.slice(0, 3), [isWebUI, items]);

  const openModal = useCallback((id: string) => {
    return () => {
      if (id === DOWNLOAD_EXTENSION) {
        openInNewTab(EXTENSION_URL)();

        return;
      }

      if (id === CREATE_ACCOUNT_MODAL) {
        setSelectedAccountTypes(DEFAULT_ACCOUNT_TYPES);
        navigate('/accounts/new-seed-phrase');
      } else {
        inactiveModal(SELECT_ACCOUNT_MODAL);
        activeModal(id);
      }
    };
  }, [activeModal, inactiveModal, navigate]
  );

  useLayoutEffect(() => {
    if (!isAccountsEmpty) {
      goHome();
    }
  }, [goHome, isAccountsEmpty]);

  return (
    <Layout.Base
      className={CN(className, '__welcome-layout-containter')}
    >
      {!isWebUI && <div className='bg-image' />}
      <div className={CN('body-container', {
        '__web-ui': isWebUI,
        'flex-column': isWebUI
      })}
      >
        <div className={CN('brand-container', 'flex-column')}>
          <div className='logo-container'>
            <Logo2DWithBorder
              height={'100%'}
              width={'100%'}
            />
          </div>
          <div className='title'>{t('Welcome to SubWallet!')}</div>
          <div className='sub-title'>
            {t(isWebUI ? "Choose how you'd like to set up your wallet" : 'Polkadot, Substrate & Ethereum wallet')}
          </div>
        </div>

        <div className='buttons-container'>
          <div className='buttons'>
            {buttonList.map((item) => (
              <Button
                block={true}
                className={CN('welcome-import-button', `type-${item.id}`)}
                contentAlign='left'
                icon={
                  <Icon
                    className='welcome-import-icon'
                    phosphorIcon={item.icon}
                    size='md'
                    weight='fill'
                  />
                }
                key={item.id}
                onClick={openModal(item.id)}
                schema={item.schema}
              >
                <div className='welcome-import-button-content'>
                  <div className='welcome-import-button-title'>
                    {t(item.title)}
                  </div>
                  <div className='welcome-import-button-description'>
                    {t(item.description)}
                  </div>
                </div>
              </Button>
            ))}
          </div>

          <div className='divider' />
        </div>

        {isWebUI && (
          <>
            <Form
              className={CN('add-wallet-container', 'flex-column')}
              form={form}
              initialValues={formDefault}
              onFieldsChange={onFieldsChange}
              onFinish={onSubmitAttachReadonlyAccount}
            >
              <div className='form-title lg-text'>{t('Watch any wallet')}?</div>
              <Form.Item
                name={'address'}
                rules={[
                  {
                    message: t('Account address is required'),
                    required: true
                  },
                  {
                    validator: accountAddressValidator
                  }
                ]}
                statusHelpAsTooltip={true}
              >
                <Input
                  placeholder={t('Enter address')}
                  prefix={<Wallet size={24} />}
                  type={'text'}
                />
              </Form.Item>
              <Button
                block
                className='add-wallet-button'
                disabled={isAttachReadonlyAccountButtonDisable}
                loading={loading}
                onClick={form.submit}
                schema='primary'
              >
                {t('Add watch-only wallet')}
              </Button>
            </Form>

            <SocialGroup className={'social-group'} />
          </>
        )}
      </div>
    </Layout.Base>
  );
}

const Welcome = styled(Component)<Props>(({ theme: { token } }: Props) => {
  return {
    position: 'relative',

    '.ant-sw-screen-layout-body': {
      display: 'flex',
      flexDirection: 'column'
    },

    '.flex-column': {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-around',
      alignItems: 'center'
    },

    '.logo-container': {
      height: 120
    },

    '.bg-image': {
      backgroundImage: 'url("/images/subwallet/welcome-background.png")',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'top',
      backgroundSize: 'contain',
      height: '100%',
      position: 'absolute',
      width: '100%',
      left: 0,
      top: 0,
      opacity: 0.1,
      zIndex: -1
    },

    '.brand-container': {
      paddingTop: 6
    },

    '.divider': {
      height: 2,
      backgroundColor: token.colorBgDivider,
      opacity: 0.8,
      width: '100%'
    },

    '.body-container': {
      padding: `0 ${token.padding}px`,
      textAlign: 'center',
      opacity: 0.999, // Hot fix show wrong opacity in browser

      '.title': {
        marginTop: token.margin,
        fontWeight: token.fontWeightStrong,
        fontSize: token.fontSizeHeading3,
        lineHeight: token.lineHeightHeading3,
        color: token.colorTextBase
      },

      '.sub-title': {
        marginTop: token.marginXS,
        marginBottom: token.sizeLG * 2 + token.sizeXS,
        fontSize: token.fontSizeHeading5,
        lineHeight: token.lineHeightHeading5,
        color: token.colorTextLight3
      },

      '.form-title': {
        color: token.colorTextLight3,
        marginBottom: token.margin
      },

      '.add-wallet-container': {
        maxWidth: 384,
        width: '100%',
        alignItems: 'stretch',
        marginBottom: token.margin
      },

      '&.__web-ui': {
        textAlign: 'center',
        height: '100%',
        width: '100%',
        maxWidth: 816,
        margin: '0 auto',

        '.title': {
          marginTop: token.marginSM + 4,
          marginBottom: token.marginXS
        },

        '.sub-title': {
          margin: 0
        },

        '.logo-container': {
          marginTop: 0,
          color: token.colorTextBase
        },

        '.buttons-container': {
          marginBottom: token.marginXL,
          marginTop: token.marginXL * 2,
          width: '100%',

          '.divider': {
            marginTop: token.marginLG
          },

          '.buttons': {
            display: 'grid',
            // flexDirection: "column",
            gridTemplateRows: '1fr 1fr',
            gridTemplateColumns: '1fr 1fr',
            gap: token.sizeMS,

            [`.type-${CREATE_ACCOUNT_MODAL}`]: {
              color: token['green-6']
            },

            [`.type-${IMPORT_ACCOUNT_MODAL}`]: {
              color: token['orange-7']
            },

            [`.type-${ATTACH_ACCOUNT_MODAL}`]: {
              color: token['magenta-6']
            },
            [`.type-${DOWNLOAD_EXTENSION}`]: {
              color: '#4CEAAC'
            },

            '.welcome-import-button': {
              width: '100%',
              paddingRight: 14
            }
          }
        }
      }
    },

    '.buttons-container': {
      '.buttons': {
        display: 'flex',
        flexDirection: 'column',
        gap: token.sizeXS
      }
    },

    '.welcome-import-button': {
      height: 'auto',

      '.welcome-import-icon': {
        height: token.sizeLG,
        width: token.sizeLG,
        marginLeft: token.sizeMD - token.size
      },

      '.welcome-import-button-content': {
        display: 'flex',
        flexDirection: 'column',
        gap: token.sizeXXS,
        fontWeight: token.fontWeightStrong,
        padding: `${token.paddingSM - 1}px ${token.paddingLG}px`,
        textAlign: 'start',

        '.welcome-import-button-title': {
          fontSize: token.fontSizeHeading5,
          lineHeight: token.lineHeightHeading5,
          color: token.colorTextBase
        },

        '.welcome-import-button-description': {
          fontSize: token.fontSizeHeading6,
          lineHeight: token.lineHeightHeading6,
          color: token.colorTextLabel
        }
      }
    },

    '.social-group': {
      paddingTop: token.paddingLG
    }

  };
});

export default Welcome;
