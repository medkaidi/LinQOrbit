package com.linqorbit.auth;

import java.util.List;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import com.linqorbit.auth.dto.UserResponse;
import com.linqorbit.user.User;
import com.linqorbit.user.UserSex;

@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(target = "sex", qualifiedByName = "sexToApi")
    @Mapping(target = "roles", source = "roles")
    @Mapping(target = "isRecruiter", source = "isRecruiter")
    UserResponse toUserResponse(User user, List<Short> roles, boolean isRecruiter);

    @Named("sexToApi")
    default String sexToApi(UserSex sex) {
        return sex == null ? null : sex.getApiValue();
    }
}
