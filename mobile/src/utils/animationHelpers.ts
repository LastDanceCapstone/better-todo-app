import React from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';

// Enable layout animation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Trigger a smooth layout animation when tasks are added/removed/updated
 * in a list
 */
export const animateTaskListUpdate = () => {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      220, // duration
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity
    )
  );
};

/**
 * Trigger a smoother spring-like animation for task completion
 */
export const animateTaskCompletion = () => {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      280, // slightly longer for satisfying feel
      LayoutAnimation.Types.spring,
      LayoutAnimation.Properties.scaleXY
    )
  );
};

/**
 * Trigger animation for task creation
 */
export const animateTaskCreation = () => {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      300,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity
    )
  );
};

/**
 * Trigger animation for task deletion
 */
export const animateTaskDeletion = () => {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      200,
      LayoutAnimation.Types.easeIn,
      LayoutAnimation.Properties.opacity
    )
  );
};
