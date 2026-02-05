import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, useColorScheme } from 'react-native';

interface AuthButtonProps {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
}

const TINT_LIGHT = '#0a7ea4';

export const AuthButton = ({ title, onPress, loading, disabled }: AuthButtonProps) => {
    const isDisabled = disabled || loading;
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const backgroundColor = isDark ? '#fff' : TINT_LIGHT;
    const textColor = isDark ? TINT_LIGHT : '#fff';

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={isDisabled}
            activeOpacity={0.85}
            style={{ backgroundColor }}
            className={`w-full min-h-[48px] rounded-xl items-center justify-center ${isDisabled ? 'opacity-50' : ''}`}
        >
            {loading ? (
                <ActivityIndicator color={textColor} />
            ) : (
                <Text style={{ color: textColor }} className="font-bold text-base">
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
};
