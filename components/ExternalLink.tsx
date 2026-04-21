import * as WebBrowser from 'expo-web-browser';
import React from 'react';
import { Platform, Pressable, type PressableProps } from 'react-native';

type Props = Omit<PressableProps, 'onPress'> & { href: string };

export function ExternalLink({ href, ...rest }: Props) {
  return (
    <Pressable
      {...rest}
      onPress={() => {
        if (Platform.OS !== 'web') {
          WebBrowser.openBrowserAsync(href);
        } else {
          window.open(href, '_blank');
        }
      }}
    />
  );
}
