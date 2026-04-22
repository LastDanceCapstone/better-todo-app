import { Request, RequestHandler } from 'express';
import { z } from 'zod';

const CUID_PATTERN = /^c[a-z0-9]{24}$/i;

const taskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const taskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
const subtaskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
const notificationTypeSchema = z.enum(['TASK_DUE_SOON', 'TASK_OVERDUE', 'MORNING_OVERVIEW', 'EVENING_REVIEW']);

const cuidSchema = z.string().regex(CUID_PATTERN, 'Invalid identifier format');

const optionalDateString = z
  .union([z.string().trim().min(1), z.null()])
  .optional()
  .refine((value) => {
    if (value === undefined || value === null) return true;
    return !Number.isNaN(new Date(value).getTime());
  }, 'Must be a valid date string or null');

const analyticsDateString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Must be a valid date string')
  .optional();

type RequestSchemas = {
  body?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
};

const formatIssues = (issues: z.ZodIssue[]) => {
  return issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : 'request',
    message: issue.message,
  }));
};

export const validate = (schemas: RequestSchemas): RequestHandler => {
  return (req: Request, res, next) => {
    const details: Array<{ field: string; message: string }> = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        details.push(...formatIssues(result.error.issues).map((d) => ({ ...d, field: `body.${d.field}` })));
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        details.push(...formatIssues(result.error.issues).map((d) => ({ ...d, field: `params.${d.field}` })));
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        details.push(...formatIssues(result.error.issues).map((d) => ({ ...d, field: `query.${d.field}` })));
      }
    }

    if (details.length > 0) {
      return res.status(400).json({
        error: 'Invalid request',
        details,
      });
    }

    next();
  };
};

export const registerValidation = validate({
  body: z
    .object({
      email: z.string().trim().toLowerCase().email('Email must be a valid email address'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      firstName: z.string().trim().min(1, 'First name cannot be empty').max(100).optional(),
      lastName: z.string().trim().min(1, 'Last name cannot be empty').max(100).optional(),
    })
    .strict(),
});

export const noQueryValidation = validate({
  query: z.object({}).strict(),
});

export const loginValidation = validate({
  body: z
    .object({
      email: z.string().trim().toLowerCase().email('Email must be a valid email address'),
      password: z.string().min(1, 'Password is required'),
    })
    .strict(),
});

export const googleAuthValidation = validate({
  body: z
    .object({
      idToken: z.string().trim().min(1, 'idToken is required'),
    })
    .strict(),
});

export const appleAuthValidation = validate({
  body: z
    .object({
      idToken: z.string().trim().min(1, 'idToken is required'),
      user: z
        .object({
          name: z
            .object({
              firstName: z.string().trim().optional(),
              lastName: z.string().trim().optional(),
            })
            .optional(),
          email: z.string().trim().toLowerCase().email('Invalid email format').optional(),
        })
        .optional(),
    })
    .strict(),
});

export const forgotPasswordValidation = validate({
  body: z
    .object({
      email: z
        .string()
        .trim()
        .toLowerCase()
        .email('Email must be a valid email address')
        .optional(),
    })
    .strict(),
});

export const resetPasswordValidation = validate({
  body: z
    .object({
      token: z.string().trim().min(1, 'token is required'),
      newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    })
    .strict(),
});

export const validateResetTokenValidation = validate({
  query: z
    .object({
      token: z.string().trim().min(1, 'token is required'),
    })
    .strict(),
});

export const verifyEmailValidation = validate({
  body: z
    .object({
      email: z.string().trim().toLowerCase().email('Email must be a valid email address'),
      code: z.string().trim().min(6, 'Verification code is required').max(64),
    })
    .strict(),
});

export const resendVerificationValidation = validate({
  body: z
    .object({
      email: z.string().trim().toLowerCase().email('Email must be a valid email address'),
    })
    .strict(),
});

export const createFocusSessionValidation = validate({
  body: z
    .object({
      taskId: cuidSchema.optional(),
      startedAt: z.string().trim().refine((value) => !Number.isNaN(new Date(value).getTime()), 'startedAt must be a valid date string'),
      endedAt: z.string().trim().refine((value) => !Number.isNaN(new Date(value).getTime()), 'endedAt must be a valid date string'),
      plannedDurationSeconds: z.number().int().positive('plannedDurationSeconds must be greater than 0').max(4 * 60 * 60),
      actualDurationSeconds: z.number().int().nonnegative('actualDurationSeconds must be non-negative').max(4 * 60 * 60),
      completed: z.boolean(),
      interrupted: z.boolean(),
    })
    .strict(),
});

export const updateProfileValidation = validate({
  body: z
    .object({
      firstName: z.union([z.string().trim().min(1, 'First name cannot be empty').max(100), z.null()]).optional(),
      lastName: z.union([z.string().trim().min(1, 'Last name cannot be empty').max(100), z.null()]).optional(),
      timezone: z.string().trim().min(1, 'timezone cannot be empty').max(100).optional(),
    })
    .strict()
    .refine((payload) => Object.keys(payload).length > 0, {
      message: 'At least one field is required',
      path: [],
    }),
});

export const updateAvatarValidation = validate({
  body: z
    .object({
      fileKey: z.union([z.string().trim().min(1, 'fileKey must be a non-empty string'), z.null()]),
    })
    .strict(),
});

export const avatarUploadPresignValidation = validate({
  body: z
    .object({
      fileName: z.string().trim().min(1, 'fileName is required').max(255),
      mimeType: z.string().trim().min(1, 'mimeType is required').max(100),
      fileSize: z.number().int().positive('fileSize must be greater than 0').max(10 * 1024 * 1024),
    })
    .strict(),
});

export const registerPushDeviceValidation = validate({
  body: z
    .object({
      installationId: z.string().trim().min(1, 'installationId is required').max(200),
      expoPushToken: z.string().trim().min(1, 'expoPushToken is required').max(255),
      platform: z.enum(['ios', 'android']),
      deviceName: z.string().trim().max(200).optional(),
      appVersion: z.string().trim().max(50).optional(),
      timezone: z.string().trim().min(1).max(100).optional(),
    })
    .strict(),
});

export const unregisterPushDeviceValidation = validate({
  body: z
    .object({
      installationId: z.string().trim().min(1, 'installationId is required').max(200),
    })
    .strict(),
});

export const aiParseTaskValidation = validate({
  body: z
    .object({
      text: z.string().trim().min(1, 'Field "text" is required and must be a non-empty string'),
      timezone: z.string().trim().min(1, 'Field "timezone" must be a non-empty string when provided').optional(),
    })
    .strict(),
});

export const taskIdParamValidation = validate({
  params: z
    .object({
      id: cuidSchema,
    })
    .strict(),
});

export const createTaskValidation = validate({
  body: z
    .object({
      title: z.string().trim().min(1, 'Title is required'),
      description: z.string().optional(),
      priority: taskPrioritySchema.optional(),
      status: taskStatusSchema.optional(),
      dueAt: optionalDateString,
    })
    .strict(),
});

export const updateTaskValidation = validate({
  params: z
    .object({
      id: cuidSchema,
    })
    .strict(),
  body: z
    .object({
      title: z.string().trim().min(1, 'Title must be a non-empty string').optional(),
      description: z.string().nullable().optional(),
      priority: taskPrioritySchema.optional(),
      status: taskStatusSchema.optional(),
      dueAt: optionalDateString,
      completedAt: optionalDateString,
    })
    .strict()
    .refine((payload) => Object.keys(payload).length > 0, {
      message: 'At least one field is required',
      path: [],
    }),
});

export const createSubtaskValidation = validate({
  params: z
    .object({
      id: cuidSchema,
    })
    .strict(),
  body: z
    .object({
      title: z.string().trim().min(1, 'Title is required'),
      description: z.string().optional(),
      status: subtaskStatusSchema.optional(),
    })
    .strict(),
});

export const subtaskIdParamValidation = validate({
  params: z
    .object({
      id: cuidSchema,
    })
    .strict(),
});

export const updateSubtaskValidation = validate({
  params: z
    .object({
      id: cuidSchema,
    })
    .strict(),
  body: z
    .object({
      title: z.string().trim().min(1, 'Title must be a non-empty string').optional(),
      description: z.string().nullable().optional(),
      status: subtaskStatusSchema.optional(),
      completedAt: optionalDateString,
    })
    .strict()
    .refine((payload) => Object.keys(payload).length > 0, {
      message: 'At least one field is required',
      path: [],
    }),
});

export const createNotificationValidation = validate({
  body: z
    .object({
      type: notificationTypeSchema,
      title: z.string().trim().min(1, 'title is required'),
      message: z.string().trim().min(1, 'message is required'),
      taskId: cuidSchema.optional(),
    })
    .strict(),
});

export const updateNotificationSettingsValidation = validate({
  body: z
    .object({
      pushEnabled: z.boolean().optional(),
      morningOverview: z.boolean().optional(),
      eveningReview: z.boolean().optional(),
      dueSoonNotifications: z.boolean().optional(),
      overdueNotifications: z.boolean().optional(),
    })
    .strict()
    .refine((payload) => Object.keys(payload).length > 0, {
      message: 'At least one notification setting is required',
      path: [],
    }),
});

export const notificationIdParamValidation = validate({
  params: z
    .object({
      id: cuidSchema,
    })
    .strict(),
});

export const analyticsQueryValidation = validate({
  query: z
    .object({
      startDate: analyticsDateString,
      endDate: analyticsDateString,
      period: z.enum(['day', 'week']).optional(),
    })
    .strict()
    .refine((query) => {
      if (!query.startDate || !query.endDate) return true;
      return new Date(query.startDate) <= new Date(query.endDate);
    }, {
      message: 'startDate must be less than or equal to endDate',
      path: ['startDate'],
    })
    .refine((query) => {
      if (!query.startDate || !query.endDate) return true;
      const start = new Date(query.startDate).getTime();
      const end = new Date(query.endDate).getTime();
      const days = (end - start) / (1000 * 60 * 60 * 24);
      return days <= 366;
    }, {
      message: 'Date range cannot exceed 366 days',
      path: ['endDate'],
    }),
});
