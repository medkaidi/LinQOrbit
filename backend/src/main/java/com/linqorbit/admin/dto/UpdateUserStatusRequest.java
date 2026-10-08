package com.linqorbit.admin.dto;

import com.linqorbit.user.UserStatus;

import jakarta.validation.constraints.NotNull;

public record UpdateUserStatusRequest(@NotNull UserStatus status) {
}
