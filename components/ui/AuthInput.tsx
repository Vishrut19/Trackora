import { Eye, EyeOff } from 'lucide-react-native';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, TextInputProps, View } from 'react-native';

interface AuthInputProps extends TextInputProps {
    label: string;
    error?: string;
    showPasswordToggle?: boolean;
}

export const AuthInput = ({
    label,
    error,
    showPasswordToggle = false,
    secureTextEntry,
    className,
    ...props
}: AuthInputProps) => {
    const [passwordVisible, setPasswordVisible] = useState(false);

    const isSecure = showPasswordToggle ? !passwordVisible : !!secureTextEntry;
    const inputContainerClass = `w-full min-h-[48px] flex-row items-center bg-gray-50 dark:bg-gray-800 border rounded-xl px-4 ${
        error
            ? 'border-red-500 dark:border-red-400'
            : 'border-gray-300 dark:border-gray-600'
    } ${className}`;

    return (
        <View className="mb-5">
            <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                {label}
            </Text>
            {showPasswordToggle ? (
                <View className={inputContainerClass}>
                    <TextInput
                        className="flex-1 py-3.5 text-base text-gray-900 dark:text-white"
                        style={{ paddingRight: 44 }}
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry={isSecure}
                        {...props}
                    />
                    <Pressable
                        onPress={() => setPasswordVisible((v) => !v)}
                        hitSlop={12}
                        className="absolute right-3"
                    >
                        {passwordVisible ? (
                            <EyeOff size={20} color="#6B7280" />
                        ) : (
                            <Eye size={20} color="#6B7280" />
                        )}
                    </Pressable>
                </View>
            ) : (
                <TextInput
                    className={inputContainerClass + ' py-3.5 text-base text-gray-900 dark:text-white'}
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={secureTextEntry}
                    {...props}
                />
            )}
            {error && (
                <Text className="text-red-500 dark:text-red-400 text-sm mt-1">
                    {error}
                </Text>
            )}
        </View>
    );
};
