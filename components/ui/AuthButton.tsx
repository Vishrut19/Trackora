import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';

interface AuthButtonProps {
    title: string;
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
}

export const AuthButton = ({ title, onPress, loading, disabled }: AuthButtonProps) => {
    const isDisabled = disabled || loading;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={isDisabled}
            className={`w-full py-4 rounded-lg items-center justify-center ${isDisabled ? 'bg-gray-400' : 'bg-black dark:bg-white'
                }`}
        >
            {loading ? (
                <ActivityIndicator color={isDisabled ? 'white' : 'black'} />
            ) : (
                <Text className={`font-bold text-lg ${isDisabled ? 'text-gray-100' : 'text-white dark:text-black'}`}>
                    {title}
                </Text>
            )}
        </TouchableOpacity>
    );
};
