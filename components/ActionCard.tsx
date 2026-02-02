import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

interface ActionCardProps {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    subtitle?: string;
}

export function ActionCard({
    title,
    icon,
    color,
    onPress,
    disabled = false,
    loading = false,
    subtitle,
}: ActionCardProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            className={`bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex-row items-center justify-between ${disabled ? 'opacity-50' : 'active:bg-gray-50 dark:active:bg-gray-700'
                }`}
        >
            <View className="flex-1">
                <Text className="text-lg font-bold text-gray-900 dark:text-white">
                    {title}
                </Text>
                {subtitle && (
                    <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {subtitle}
                    </Text>
                )}
            </View>

            <View
                className="w-12 h-12 rounded-full items-center justify-center"
                style={{ backgroundColor: `${color}20` }} // 20% opacity
            >
                {loading ? (
                    <ActivityIndicator size="small" color={color} />
                ) : (
                    <Ionicons name={icon} size={24} color={color} />
                )}
            </View>
        </TouchableOpacity>
    );
}
