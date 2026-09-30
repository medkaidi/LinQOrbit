package com.linqorbit.auth;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.Named;

import com.linqorbit.user.User;
import com.linqorbit.user.UserSex;

@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(target = "sex", qualifiedByName = "sexToApi")
    UserResponse toUserResponse(User user);

    @Named("sexToApi")
    default String sexToApi(UserSex sex) {
        return sex == null ? null : sex.getApiValue();
    }
}
