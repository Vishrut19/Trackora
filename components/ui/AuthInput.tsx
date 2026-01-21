import React from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';

interface AuthInputProps extends TextInputProps {
    label: string;
    error?: string;
}

export const AuthInput = ({ label, error, className, ...props }: AuthInputProps) => {
    return (
        <View className="mb-4">
            <Text className="text-gray-700 dark:text-gray-300 mb-1 font-medium">
                {label}
            </Text>
            <TextInput
                className={`w-full bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-3 text-gray-900 dark:text-white ${error ? 'border-red-500' : 'focus:border-black dark:focus:border-white'
                    } ${className}`}
                placeholderTextColor="#9CA3AF"
                {...props}
            />
            {error && (
                <Text className="text-red-500 text-sm mt-1">
                    {error}
                </Text>
            )}
        </View>
    );
};
