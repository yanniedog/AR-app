import { Header } from '@react-navigation/elements';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import React from 'react';
import type { CorePayload } from '../types';
import { uiLabel, uiNavigationTitle, type UiCopy } from '../lib/uiCopy';
import { NavigationMenuButton } from './AppNavigationMenu';

/** Keeps each route's actions/title when update chrome consumes the top inset. */
export function ConsumedInsetHeader({ navigationOptions: options, back, core, fallbackTitle }: Pick<NativeStackHeaderProps, 'back'> & {
  navigationOptions: NativeStackHeaderProps['options'];
  core: CorePayload | null | undefined;
  fallbackTitle: UiCopy;
}) {
  return <Header
    title={uiNavigationTitle(options.title, core, fallbackTitle)}
    headerStyle={options.headerStyle}
    headerTitleStyle={options.headerTitleStyle}
    headerTitleAlign={options.headerTitleAlign}
    headerTintColor={options.headerTintColor}
    headerShadowVisible={options.headerShadowVisible}
    headerLeft={options.headerLeft}
    headerRight={options.headerRight ?? (() => <NavigationMenuButton />)}
    back={options.headerBackVisible === false ? undefined : back && { title: uiLabel('Back'), href: back.href }}
    headerStatusBarHeight={0}
  />;
}
