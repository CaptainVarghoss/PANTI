from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

import auth
import database
import models
import schemas

router = APIRouter()

# --- Setting Endpoints ---

@router.get("/global-settings/", response_model=List[schemas.Setting])
def read_all_global_settings(
    skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_admin_user)
):
    # Retrieves all global settings as a list of Setting objects.
    settings = db.query(models.Setting).offset(skip).limit(limit).all()
    return settings

@router.post("/settings/", response_model=schemas.Setting, status_code=status.HTTP_201_CREATED)
def create_setting(setting: schemas.SettingCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    # Creates a new global setting. Only accessible by admin users.
    # FIX THIS
    # Not likely to need setting creation (see delete function lower down)

    db_setting = models.Setting(**setting.dict())
    db.add(db_setting)
    db.commit()
    db.refresh(db_setting)
    return db_setting

@router.get("/settings/", response_model=List[schemas.Setting])
def read_settings_tiered(
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
    device_id: Optional[str] = Query(None, description="Unique ID of the client device for device-specific settings")
):
    # Retrieves a consolidated list of settings with full metadata,
    # applying a tiered fallback: Device-specific value -> Global value.

    # Fetch all global settings first, as these contain the metadata (display_name, input_type, etc.)
    global_settings_map = {s.name: s for s in db.query(models.Setting).all()}

    # Create a list to hold the final tiered settings (schema objects)
    # Initialize with copies of global settings to preserve metadata
    tiered_settings_list: List[schemas.Setting] = [
        schemas.Setting.model_validate({c.name: getattr(global_setting_obj, c.name) for c in global_setting_obj.__table__.columns})
        for global_setting_obj in global_settings_map.values()
    ]

    # Convert tiered_settings_list to a map for easy lookup by name during overrides
    tiered_settings_map_by_name = {s.name: s for s in tiered_settings_list}

    # Override with Device-Specific Settings (if logged in and device_id provided)
    if device_id:
        device_settings = db.query(models.DeviceSetting).filter_by(
            user_id=current_user.id,
            device_id=device_id
        ).all()
        for device_setting in device_settings:
            if device_setting.name in tiered_settings_map_by_name:
                setting_to_override = tiered_settings_map_by_name[device_setting.name]
                original_global_setting = global_settings_map.get(device_setting.name)

                # Only apply override if corresponding global setting exists and is NOT admin_only
                if original_global_setting and not original_global_setting.admin_only:
                    setting_to_override.value = device_setting.value
                    setting_to_override.source = 'device' # Add a source indicator
                else:
                    print(f"Warning: DeviceSetting '{device_setting.name}' found for admin-only global setting or missing global setting. Ignoring override in tiered view.")

    return list(tiered_settings_map_by_name.values())

@router.get("/settings/{setting_id}", response_model=schemas.Setting)
def read_setting(setting_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    # Retrieves a single global setting by ID. Only accessible by admin users.
    # FIX THIS
    # Probably not needed, most code should have access to all settings

    db_setting = db.query(models.Setting).filter(models.Setting.id == setting_id).first()
    if db_setting is None:
        raise HTTPException(status_code=404, detail="Setting not found")
    return db_setting

@router.put("/settings/{setting_id}", response_model=schemas.Setting)
def update_setting(setting_id: int, setting: schemas.SettingUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    # Updates an existing global setting. Only accessible by admin users.

    db_setting = db.query(models.Setting).filter(models.Setting.id == setting_id).first()
    if db_setting is None:
        raise HTTPException(status_code=404, detail="Setting not found")

    for key, value in setting.dict(exclude_unset=True).items():
        setattr(db_setting, key, value)
    db.commit()
    db.refresh(db_setting)
    return db_setting

@router.delete("/settings/{setting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_setting(setting_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_admin_user)):
    # Deletes a global setting. Only accessible by admin users.
    # FIX THIS
    # Not needed? why would I delete a setting

    db_setting = db.query(models.Setting).filter(models.Setting.id == setting_id).first()
    if db_setting is None:
        raise HTTPException(status_code=404, detail="Setting not found")
    db.delete(db_setting)
    db.commit()
    return

# --- DeviceSetting Endpoints ---

@router.post("/devicesettings/", response_model=schemas.DeviceSetting, status_code=status.HTTP_201_CREATED)
def create_device_setting(device_setting: schemas.DeviceSettingCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Creates a new device-specific setting.
    # Requires authentication. Users can only create settings for their own user_id.
    # FIX THIS
    # Similar to global setting creation, should happen automatically if needed otherwise route is uneeded

    if not current_user.admin and device_setting.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to create device settings for other users.")

    global_setting = db.query(models.Setting).filter_by(name=device_setting.name).first()
    if not global_setting:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot create device setting for non-existent global setting '{device_setting.name}'.")
    if global_setting.admin_only:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Setting '{device_setting.name}' is an admin-only global setting and cannot be overridden by any user at the device level.")

    db_device_setting = models.DeviceSetting(**device_setting.dict())
    db.add(db_device_setting)
    db.commit()
    db.refresh(db_device_setting)
    return db_device_setting

@router.get("/devicesettings/", response_model=List[schemas.DeviceSetting])
def read_device_settings(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(auth.get_current_user),
    target_user_id: Optional[int] = Query(None, description="Filter by user ID (admin only)"),
    name: Optional[str] = Query(None, description="Filter by setting name"),
    device_id: Optional[str] = Query(None, description="Filter by device ID")
):
    # Retrieves a list of device-specific settings.
    # Requires authentication. Users can only view their own settings unless they are admin.
    # Supports filtering by user_id (admin only), name, and device_id.

    query = db.query(models.DeviceSetting)

    if current_user.admin:
        if target_user_id is not None:
            query = query.filter(models.DeviceSetting.user_id == target_user_id)
        if device_id is not None:
            query = query.filter(models.DeviceSetting.device_id == device_id)
        if name is not None:
            query = query.filter(models.DeviceSetting.name == name)
    else: # Non-admin user
        if target_user_id is not None and target_user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view other users' device settings.")

        query = query.filter(models.DeviceSetting.user_id == current_user.id)
        if device_id is not None:
            query = query.filter(models.DeviceSetting.device_id == device_id)
        if name is not None:
            query = query.filter(models.DeviceSetting.name == name)

    device_settings = query.offset(skip).limit(limit).all()
    return device_settings

@router.get("/devicesettings/{device_setting_id}", response_model=schemas.DeviceSetting)
def read_device_setting(device_setting_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Retrieves a single device-specific setting by ID.
    # Requires authentication. Users can only view their own settings unless they are admin.
    # FIX THIS
    # Not sure single setting is needed, use all settings? See global read_settings

    db_device_setting = db.query(models.DeviceSetting).filter(models.DeviceSetting.id == device_setting_id).first()
    if db_device_setting is None:
        raise HTTPException(status_code=404, detail="DeviceSetting not found")

    if not current_user.admin and db_device_setting.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view this device setting.")
    return db_device_setting

@router.put("/devicesettings/{device_setting_id}", response_model=schemas.DeviceSetting)
def update_device_setting(device_setting_id: int, device_setting: schemas.DeviceSettingUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Updates an existing device-specific setting.
    # Requires authentication. Users can only update their own settings unless they are admin.

    db_device_setting = db.query(models.DeviceSetting).filter(models.DeviceSetting.id == device_setting_id).first()
    if db_device_setting is None:
        raise HTTPException(status_code=404, detail="DeviceSetting not found")

    if not current_user.admin and db_device_setting.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to update this device setting.")

    if not current_user.admin and device_setting.user_id is not None and device_setting.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to change user_id of device settings.")

    setting_name_for_check = db_device_setting.name

    global_setting = db.query(models.Setting).filter_by(name=setting_name_for_check).first()
    if global_setting and global_setting.admin_only:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Setting '{setting_name_for_check}' is an admin-only global setting and cannot be overridden by any user at the device level.")

    for key, value in device_setting.dict(exclude_unset=True).items():
        setattr(db_device_setting, key, value)
    db.commit()
    db.refresh(db_device_setting)
    return db_device_setting

@router.delete("/devicesettings/{device_setting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device_setting(device_setting_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Deletes a device-specific setting.
    # Requires authentication. Users can only delete their own settings unless they are admin.
    # FIX THIS
    # Probably not needed at all.. maybe to clear setting to fallback on global?

    db_device_setting = db.query(models.DeviceSetting).filter(models.DeviceSetting.id == device_setting_id).first()
    if db_device_setting is None:
        raise HTTPException(status_code=404, detail="DeviceSetting not found")

    if not current_user.admin and db_device_setting.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to delete this device setting.")
    db.delete(db_device_setting)
    db.commit()
    return
