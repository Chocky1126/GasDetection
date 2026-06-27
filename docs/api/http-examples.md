# HTTP Examples

登录：

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123456"}'
```

保存 token：

```bash
export TOKEN="paste-access-token-here"
```

查看监测总览：

```bash
curl http://localhost:3000/api/v1/monitor/overview \
  -H "Authorization: Bearer $TOKEN"
```

查看设备：

```bash
curl "http://localhost:3000/api/v1/devices?pageSize=20" \
  -H "Authorization: Bearer $TOKEN"
```

查看活跃报警：

```bash
curl "http://localhost:3000/api/v1/alarms?status=ACTIVE&pageSize=20" \
  -H "Authorization: Bearer $TOKEN"
```
