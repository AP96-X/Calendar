# -*- coding: utf-8 -*-
"""站点运行时设置 —— 管理员在管理页配置，数据库优先，环境变量兜底。

生效优先级：site_settings 表中的值 > 环境变量（backend.config 常量）> 代码内置默认值。
管理员点击「恢复默认」会删除表中对应行，从而回落到环境变量 / 内置默认值。

这样既保留了原有的 Docker `.env` 注入方式，又允许管理员登录后在管理页面直接修改
AI 报告与备案信息，无需改文件、重启容器。
"""

from .config import (
    AI_REPORT_ENABLED, AI_PROVIDER, AI_API_BASE, AI_API_KEY,
    AI_MODEL, AI_TIMEOUT, AI_MAX_TOKENS, AI_MONTHLY_LIMIT,
    ICP_NUMBER, PUBLIC_SECURITY_NUMBER,
)
from .database import get_db, db_now

AI_GROUP = 'ai'
SITE_GROUP = 'site'

PROVIDER_VALUES = ('openai-compatible', 'ollama')

# 受管理的设置项：group 分组、type 决定校验与前端控件、default 为环境变量兜底值。
# sensitive=True 的项只写不回显（接口返回空值 + xxx_set 标记）。
SETTING_DEFS = {
    'AI_REPORT_ENABLED': {
        'group': AI_GROUP, 'type': 'bool', 'default': AI_REPORT_ENABLED,
        'label': '启用 AI 报告',
    },
    'AI_PROVIDER': {
        'group': AI_GROUP, 'type': 'enum', 'default': AI_PROVIDER,
        'allowed': PROVIDER_VALUES, 'label': '服务类型',
    },
    'AI_API_BASE': {
        'group': AI_GROUP, 'type': 'url', 'default': AI_API_BASE,
        'max_len': 300, 'label': 'API 地址',
    },
    'AI_API_KEY': {
        'group': AI_GROUP, 'type': 'secret', 'default': AI_API_KEY,
        'max_len': 500, 'sensitive': True, 'label': 'API Key',
    },
    'AI_MODEL': {
        'group': AI_GROUP, 'type': 'str', 'default': AI_MODEL,
        'max_len': 120, 'label': '模型名',
    },
    'AI_TIMEOUT': {
        'group': AI_GROUP, 'type': 'int', 'default': AI_TIMEOUT,
        'min': 1, 'max': 600, 'label': '请求超时',
    },
    'AI_MAX_TOKENS': {
        'group': AI_GROUP, 'type': 'int', 'default': AI_MAX_TOKENS,
        'min': 256, 'max': 32768, 'label': '最大生成长度',
    },
    'AI_MONTHLY_LIMIT': {
        'group': AI_GROUP, 'type': 'int', 'default': AI_MONTHLY_LIMIT,
        'min': 0, 'max': 100000, 'label': '每月次数上限',
    },
    'ICP_NUMBER': {
        'group': SITE_GROUP, 'type': 'str', 'default': ICP_NUMBER,
        'max_len': 64, 'label': 'ICP 备案号',
    },
    'PUBLIC_SECURITY_NUMBER': {
        'group': SITE_GROUP, 'type': 'str', 'default': PUBLIC_SECURITY_NUMBER,
        'max_len': 64, 'label': '公安备案号',
    },
}


class SettingValidationError(ValueError):
    """设置项校验失败（路由层转换为 400 响应）。"""


# ==================== 读取 ====================

def _load_overrides():
    """一次性读取所有被管理员覆盖过的设置（DB 中存在的行）。"""
    db = get_db()
    rows = db.execute('SELECT `key`, `value` FROM site_settings').fetchall()
    return {r['key']: r['value'] for r in rows}


def _coerce(key, raw):
    """把数据库中的字符串转成对应的 Python 类型。"""
    meta = SETTING_DEFS[key]
    kind = meta['type']
    if kind == 'bool':
        return str(raw).strip().lower() in ('1', 'true', 'yes', 'on')
    if kind == 'int':
        try:
            return int(str(raw).strip())
        except (TypeError, ValueError):
            return meta['default']
    return raw


def _effective(overrides, key):
    if key in overrides:
        return _coerce(key, overrides[key])
    return SETTING_DEFS[key]['default']


def get_ai_config():
    """返回 AI 报告的生效配置（每次调用实时读取，页面保存后立即生效）。"""
    overrides = _load_overrides()
    return {
        'enabled': bool(_effective(overrides, 'AI_REPORT_ENABLED')),
        'provider': _effective(overrides, 'AI_PROVIDER'),
        'api_base': str(_effective(overrides, 'AI_API_BASE') or '').strip().rstrip('/'),
        'api_key': str(_effective(overrides, 'AI_API_KEY') or '').strip(),
        'model': _effective(overrides, 'AI_MODEL'),
        'timeout': int(_effective(overrides, 'AI_TIMEOUT')),
        'max_tokens': int(_effective(overrides, 'AI_MAX_TOKENS')),
        'monthly_limit': int(_effective(overrides, 'AI_MONTHLY_LIMIT')),
    }


def get_site_info():
    """返回站点公开信息（备案号），无需登录即可展示。"""
    overrides = _load_overrides()
    return {
        'icp_number': str(_effective(overrides, 'ICP_NUMBER') or '').strip(),
        'public_security_number': str(_effective(overrides, 'PUBLIC_SECURITY_NUMBER') or '').strip(),
    }


def get_admin_payload():
    """返回管理页所需的数据：生效值 + 是否已被管理员覆盖。

    敏感项（AI_API_KEY）不回显真实值，仅返回空字符串与 `AI_API_KEY_set` 标记，
    未修改时前端留空提交即可保持原值。
    """
    overrides = _load_overrides()
    values = {}
    customized = {}
    for key, meta in SETTING_DEFS.items():
        value = _effective(overrides, key)
        customized[key] = key in overrides
        if meta.get('sensitive'):
            values[key] = ''
            values[f'{key}_set'] = bool(str(value or '').strip())
        else:
            values[key] = value
    return {'values': values, 'customized': customized}


# ==================== 写入 ====================

def _validate(key, raw):
    """校验并归一化为存储字符串；非法时抛 SettingValidationError。"""
    meta = SETTING_DEFS[key]
    kind = meta['type']

    if kind == 'bool':
        if isinstance(raw, bool):
            return '1' if raw else '0'
        if isinstance(raw, (int, float)):
            return '1' if raw else '0'
        return '1' if str(raw).strip().lower() in ('1', 'true', 'yes', 'on') else '0'

    if kind == 'int':
        try:
            num = int(str(raw).strip())
        except (TypeError, ValueError):
            raise SettingValidationError(f'{meta["label"]}必须为整数') from None
        if not (meta['min'] <= num <= meta['max']):
            raise SettingValidationError(
                f'{meta["label"]}必须在 {meta["min"]}~{meta["max"]} 之间')
        return str(num)

    if kind == 'enum':
        value = str(raw).strip()
        if value not in meta['allowed']:
            raise SettingValidationError(
                f'{meta["label"]}仅支持：{"、".join(meta["allowed"])}')
        return value

    value = '' if raw is None else str(raw).strip()
    if len(value) > meta.get('max_len', 500):
        raise SettingValidationError(f'{meta["label"]}长度不能超过 {meta["max_len"]}')
    if kind == 'url' and value and not value.lower().startswith(('http://', 'https://')):
        raise SettingValidationError(f'{meta["label"]}必须以 http:// 或 https:// 开头')
    return value


def set_values(values):
    """写入管理员提交的设置，返回被更新的 key 列表；非法时抛 SettingValidationError。"""
    if not isinstance(values, dict):
        raise SettingValidationError('参数格式错误')

    normalized = {}
    for key, raw in values.items():
        if key not in SETTING_DEFS:
            raise SettingValidationError(f'未知设置项：{key}')
        # 敏感项留空 = 不修改（前端不回显真实值）
        if SETTING_DEFS[key].get('sensitive') and (raw is None or str(raw).strip() == ''):
            continue
        normalized[key] = _validate(key, raw)

    if not normalized:
        return []

    db = get_db()
    now = db_now()
    for key, value in normalized.items():
        db.execute(
            'INSERT OR REPLACE INTO site_settings (`key`, `value`, updated_at) VALUES (?, ?, ?)',
            (key, value, now))
    db.commit()
    return sorted(normalized)


def reset_values(keys=None):
    """删除覆盖值（回落到环境变量 / 内置默认值）；keys 为空表示全部恢复默认。"""
    if keys is not None and not isinstance(keys, (list, tuple)):
        raise SettingValidationError('keys 必须为数组')

    db = get_db()
    if keys is None:
        db.execute('DELETE FROM site_settings')
        db.commit()
        return list(SETTING_DEFS)

    for key in keys:
        if key not in SETTING_DEFS:
            raise SettingValidationError(f'未知设置项：{key}')
    for key in keys:
        db.execute('DELETE FROM site_settings WHERE `key` = ?', (key,))
    db.commit()
    return sorted(keys)
