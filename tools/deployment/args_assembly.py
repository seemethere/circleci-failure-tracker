import os
import json


WEBAPP_BINARY_NAME = "my-webapp"


WEBAPP_INTERNAL_PORT = 3001


def generate_dockerrun_aws_json(output_path, nondefault_cli_arglist, entrypoint_override=None):

    json_object = {
        "AWSEBDockerrunVersion": "1",
        "Image": {
            "Name": "kostmo/circleci-failure-tracker-img-small-my-webapp",
        },
        "Ports": [
            {
                "ContainerPort": WEBAPP_INTERNAL_PORT,
            }
        ],
        "Entrypoint": os.path.join("/opt/app", entrypoint_override if entrypoint_override else WEBAPP_BINARY_NAME),
        "Command": " ".join(nondefault_cli_arglist),
    }

    with open(output_path, "w") as fh:
        json.dump(json_object, fh, indent=4, sort_keys=True)


def generate_app_nondefault_cli_arglist(
        app_credentials_json,
        db_credentials_json,
        db_mview_credentials_json,
        personal_token,
        is_notification_ingester,
        no_force_ssl):

    arg_list = [
        "--github-client-id",
        app_credentials_json["github-client-id"],
        "--github-client-secret",
        app_credentials_json["github-client-secret"],
        "--github-webhook-secret",
        app_credentials_json["github-webhook-secret"],
        "--db-hostname",
        db_credentials_json["db-hostname"],
        "--db-username",
        db_credentials_json["db-user"],
        "--db-password",
        db_credentials_json["db-password"],
        "--db-mview-username",
        db_mview_credentials_json["db-user"],
        "--db-mview-password",
        db_mview_credentials_json["db-password"],
        "--admin-password",
        app_credentials_json["admin-password"],
        "--github-personal-access-token",
        personal_token,
    ]

    if no_force_ssl:
        arg_list.append("--no-force-ssl")

    return arg_list
